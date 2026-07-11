import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time
import random
import logging
from celery import Celery
from backend.config import settings
from backend.database import SessionLocal, DocumentMetadata

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Celery app
celery_app = Celery(
    "docmind_workers",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

# Optional configuration updates
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    broker_connection_retry_on_startup=True
)

# ==========================================
# TEXT EXTRACTION HELPERS
# ==========================================

def extract_text_from_file(file_path: str) -> list:
    """
    Extracts text page by page or block by block from PDF, DOCX, or TXT.
    Returns a list of dicts: [{'page': page_num, 'text': text_content}]
    """
    ext = os.path.splitext(file_path)[1].lower()
    pages_data = []
    
    try:
        if ext == ".pdf":
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            for idx, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                pages_data.append({"page": idx + 1, "text": text.strip()})
                
        elif ext == ".docx":
            import docx
            doc = docx.Document(file_path)
            # Group every 4 paragraphs as a "page" for simplicity
            current_page_text = []
            page_num = 1
            for idx, para in enumerate(doc.paragraphs):
                if para.text.strip():
                    current_page_text.append(para.text.strip())
                if (idx + 1) % 4 == 0 and current_page_text:
                    pages_data.append({"page": page_num, "text": "\n".join(current_page_text)})
                    current_page_text = []
                    page_num += 1
            if current_page_text:
                pages_data.append({"page": page_num, "text": "\n".join(current_page_text)})
                
        else: # Default to plain text
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            # Split by 1000 characters as a "page"
            chunk_size = 1500
            for idx in range(0, len(content), chunk_size):
                text_slice = content[idx : idx + chunk_size]
                pages_data.append({"page": (idx // chunk_size) + 1, "text": text_slice.strip()})
                
    except Exception as e:
        logger.error(f"Error extracting text from {file_path}: {str(e)}")
        raise e
        
    return [p for p in pages_data if p["text"]] # Filter empty pages

# ==========================================
# PARENT-CHILD CHUNKING & EMBEDDINGS
# ==========================================

class LocalEmbeddingGenerator:
    """
    Tries loading BGE embeddings locally using SentenceTransformers.
    Falls back to a deterministic vector generator if offline/memory constrainted.
    """
    def __init__(self):
        self.model = None
        try:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL_NAME}...")
            self.model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
            logger.info("Embedding model loaded successfully.")
        except Exception as e:
            logger.warning(f"Could not load local sentence transformer: {str(e)}. Using fallback embeddings.")

    def get_embeddings(self, texts: list) -> list:
        if self.model:
            try:
                embeddings = self.model.encode(texts)
                return [emb.tolist() for emb in embeddings]
            except Exception as e:
                logger.error(f"Error generating model embeddings: {str(e)}")
        
        # Fallback pseudo-random deterministic embeddings
        logger.info("Generating fallback deterministic embeddings.")
        dummy_embs = []
        for text in texts:
            # Seed based on text hash
            random.seed(hash(text))
            dummy_emb = [random.uniform(-1, 1) for _ in range(768)]
            dummy_embs.append(dummy_emb)
        return dummy_embs

# Global generator instance
embedding_gen = None

def get_embedding_generator():
    global embedding_gen
    if embedding_gen is None:
        embedding_gen = LocalEmbeddingGenerator()
    return embedding_gen

# ==========================================
# INGESTION WORKER TASK
# ==========================================

@celery_app.task(bind=True)
def ingest_document_task(self, doc_id: str, file_path: str, doc_name: str):
    """
    Celery task that reads a file, chunks it using Parent-Child strategy,
    computes embeddings, indexes vector metadata in ChromaDB, and updates PostgreSQL.
    """
    logger.info(f"Starting ingestion task for document: {doc_name} (ID: {doc_id})")
    
    db = SessionLocal()
    db_doc = db.query(DocumentMetadata).filter(DocumentMetadata.id == doc_id).first()
    
    if not db_doc:
        logger.error(f"Document {doc_id} not found in database metadata.")
        db.close()
        return False
        
    try:
        # Step 1: Text extraction
        pages_data = extract_text_from_file(file_path)
        total_pages = len(pages_data)
        if total_pages == 0:
            raise ValueError("No selectable text extracted. The document may be empty, corrupted, or scanned (image-only).")
        db_doc.pages = total_pages
        db.commit()
        
        # Initialize vector database
        import chromadb
        chroma_client = chromadb.PersistentClient(path=settings.CHROMA_DB_PATH)
        collection = chroma_client.get_or_create_collection(name=settings.CHROMA_COLLECTION_NAME)
        
        # Step 2: Parent-Child Chunking
        # Parent size: 1500 chars (overlap 200). Child size: 400 chars (overlap 50).
        parent_chunk_size = 1500
        parent_overlap = 200
        child_chunk_size = 400
        child_overlap = 50
        
        child_texts = []
        child_metadatas = []
        child_ids = []
        
        chunk_counter = 0
        for page_obj in pages_data:
            page_text = page_obj["text"]
            page_num = page_obj["page"]
            
            # Slide window to create parent chunks
            p_start = 0
            while p_start < len(page_text):
                p_end = p_start + parent_chunk_size
                parent_chunk = page_text[p_start:p_end]
                p_start += (parent_chunk_size - parent_overlap)
                
                # Split parent chunk into child chunks
                c_start = 0
                while c_start < len(parent_chunk):
                    c_end = c_start + child_chunk_size
                    child_chunk = parent_chunk[c_start:c_end]
                    c_start += (child_chunk_size - child_overlap)
                    
                    if len(child_chunk.strip()) > 30: # Skip noise chunks
                        chunk_id = f"{doc_id}-chunk-{chunk_counter}"
                        child_texts.append(child_chunk.strip())
                        child_metadatas.append({
                            "document_id": doc_id,
                            "document_name": doc_name,
                            "page": page_num,
                            "parent_text": parent_chunk.strip()
                        })
                        child_ids.append(chunk_id)
                        chunk_counter += 1
        
        # Step 3: Embeddings generation and ChromaDB indexing
        if child_texts:
            generator = get_embedding_generator()
            embeddings = generator.get_embeddings(child_texts)
            
            # Batch upsert to ChromaDB
            # (ChromaDB allows indexing embeddings directly)
            collection.add(
                embeddings=embeddings,
                documents=child_texts,
                metadatas=child_metadatas,
                ids=child_ids
            )
            logger.info(f"Indexed {len(child_texts)} child chunks in ChromaDB.")
            
        # Update PG database status
        db_doc.status = "INGESTED"
        db.commit()
        logger.info(f"Ingestion successful for document ID: {doc_id}")
        
    except Exception as e:
        logger.error(f"Ingestion failed for document ID: {doc_id}. Error: {str(e)}")
        db_doc.status = "ERROR"
        db.commit()
        raise e
    finally:
        db.close()
        
    return True
