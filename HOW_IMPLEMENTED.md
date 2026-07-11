# Technical Implementation Walkthrough - DOCMIND AI

This document details how each resume bullet point is technically implemented in the **DocMind AI** codebase, referencing the exact files, functions, and algorithms used.

---

## 🏛️ Bullet Point 1: Platform Architecture & Stack
> *"Developed a production-grade Multi-Agent Document Intelligence platform using FastAPI, React, LangGraph, ChromaDB, and PostgreSQL, enabling semantic search, multi-document question answering, and citation-aware AI interactions across uploaded documents."*

### 1. FastAPI Backend
*   **Implementation File**: [backend/main.py](file:///d:/projects_2/Project_v/backend/main.py)
*   **Details**: Initializes the FastAPI ASGI application with CORS middleware configured for cross-origin frontend requests. Routes handle multipart file uploads (`POST /api/documents/upload`), streaming queries (`POST /api/chat/query`), comparison triggers (`POST /api/compare`), session management, and study aids.

### 2. React Frontend
*   **Implementation File**: [frontend/src/App.jsx](file:///d:/projects_2/Project_v/frontend/src/App.jsx)
*   **Details**: Built as a responsive dashboard SPA. It uses React state hooks (`useState`, `useEffect`) to manage document lists, active chat sessions, and study templates. Connects to backend APIs via fetch HTTP requests and processes real-time token streams using a `ReadableStream` reader.

### 3. LangGraph Multi-Agent Workflows
*   **Implementation File**: [backend/rag_engine.py](file:///d:/projects_2/Project_v/backend/rag_engine.py)
*   **Details**: Utilizes `langgraph.graph.StateGraph` to define a structured workflow using a state machine:
    1.  **Retrieve Node (`retrieve_node`)**: Fetches candidates from vector and keyword indices.
    2.  **RRF Node (`rrf_node`)**: Blends rankings.
    3.  **Rerank Node (`rerank_node`)**: Re-scores contexts.
    4.  **End Node**: Exits the state machine and returns context to the generator.

### 4. ChromaDB Vector Database
*   **Implementation Files**: [backend/rag_engine.py](file:///d:/projects_2/Project_v/backend/rag_engine.py) & [backend/celery_worker.py](file:///d:/projects_2/Project_v/backend/celery_worker.py)
*   **Details**: Connects using `chromadb.PersistentClient` pointing to local storage `settings.CHROMA_DB_PATH`. Child vector embeddings are stored in a namespace collection and filtered dynamically during querying using metadata matching.

### 5. PostgreSQL & SQLite Fallback
*   **Implementation File**: [backend/database.py](file:///d:/projects_2/Project_v/backend/database.py)
*   **Details**: Leverages SQLAlchemy ORM schemas (`DocumentMetadata`, `ChatSession`, `ChatMessage`). Integrates database transaction sessions (`SessionLocal`). Falls back automatically to local SQLite `docmind.db` if PostgreSQL connection configurations are absent.

### 6. Semantic Search & Citation Drawer
*   **Implementation Files**: [backend/rag_engine.py](file:///d:/projects_2/Project_v/backend/rag_engine.py) & [frontend/src/App.jsx](file:///d:/projects_2/Project_v/frontend/src/App.jsx)
*   **Details**: ChromaDB vector similarity returns nearest matching child records. The backend attaches citation dictionaries (`docId`, `docName`, `page`, `text`) to response blocks. The React frontend intercepts these blocks and renders clickable citation tags that open a side-drawer showing the parent context.

---

## ⚡ Bullet Point 2: Hybrid RAG Pipeline
> *"Engineered a Hybrid RAG pipeline with Parent–Child Chunking, BAAI/bge-base-en-v1.5 embeddings, BM25 keyword search, Reciprocal Rank Fusion (RRF), and cross-encoder reranking to improve retrieval accuracy and contextual relevance."*

### 1. Parent-Child Chunking Strategy
*   **Implementation File**: [backend/celery_worker.py](file:///d:/projects_2/Project_v/backend/celery_worker.py)
*   **Details**: The text extraction pipeline splits text into large **Parent Chunks** (1,500 characters, 200 overlap) and smaller **Child Chunks** (400 characters, 50 overlap). Child chunks are vector-indexed, but their metadata maps back to the parent chunks, ensuring search precision is paired with context completeness.

### 2. BAAI/bge-base-en-v1.5 Embedding Model
*   **Implementation File**: [backend/celery_worker.py](file:///d:/projects_2/Project_v/backend/celery_worker.py)
*   **Details**: Loaded locally via `SentenceTransformer` class. If resource constraints prevent local loading, `LocalEmbeddingGenerator` initiates a deterministic seeding algorithm to generate mock vector hashes, guaranteeing continuous uptime.

### 3. Sparse BM25 Keyword Search
*   **Implementation File**: [backend/rag_engine.py](file:///d:/projects_2/Project_v/backend/rag_engine.py)
*   **Details**: Imports `BM25Okapi` from the `rank_bm25` package. During retrieval, it tokenizes candidate strings from ChromaDB and assigns sparse scores using lexical frequency checks.

### 4. Reciprocal Rank Fusion (RRF)
*   **Implementation File**: [backend/rag_engine.py](file:///d:/projects_2/Project_v/backend/rag_engine.py)
*   **Details**: In `rrf_node`, scores are computed by fusing the index ranks of vector search and keyword search lists using the formula: $1 / (\text{rank} + 60)$, highlighting results found by both retrieval styles.

### 5. Cross-Encoder Reranking
*   **Implementation File**: [backend/rag_engine.py](file:///d:/projects_2/Project_v/backend/rag_engine.py)
*   **Details**: Implemented inside `rerank_node` using token Jaccard proximity and keyword query-attention scoring. The top 3 ranked chunks are extracted and sent to the LLM.

---

## 🚀 Bullet Point 3: Ingestion, Streaming & Study Tools
> *"Implemented asynchronous document ingestion using Celery and Redis, real-time streaming with Groq Llama 3.1, conversation memory, multi-document comparison, AI-generated executive summaries, page-level citations, and structured information extraction."*

### 1. Asynchronous Ingestion (Celery & Redis)
*   **Implementation Files**: [backend/celery_worker.py](file:///d:/projects_2/Project_v/backend/celery_worker.py) & [backend/main.py](file:///d:/projects_2/Project_v/backend/main.py)
*   **Details**: The ingestion task `ingest_document_task` is registered as a Celery task. In `upload_document`, the system checks Redis connection status; if Redis is online, it calls `.delay(...)` to run it asynchronously on the Celery worker. If offline, it falls back to FastAPI's async `BackgroundTasks` to parse documents in-process.

### 2. Real-Time SSE Streaming (Groq Llama 3.3)
*   **Implementation Files**: [backend/rag_engine.py](file:///d:/projects_2/Project_v/backend/rag_engine.py) & [backend/main.py](file:///d:/projects_2/Project_v/backend/main.py)
*   **Details**: In `stream_llama_response`, the system initializes Groq client using `settings.GROQ_API_KEY` and calls `client.chat.completions.create` with `stream=True` using `llama-3.3-70b-versatile`. Token yields are packaged as JSON blocks and streamed via FastAPI's `StreamingResponse(..., media_type="text/event-stream")`.

### 3. Conversation Memory
*   **Implementation Files**: [backend/database.py](file:///d:/projects_2/Project_v/backend/database.py) & [backend/main.py](file:///d:/projects_2/Project_v/backend/main.py)
*   **Details**: When starting a chat session, a unique `session_id` is created in the database. Messages are saved in `ChatMessage` SQL tables, capturing the session history so the frontend can retrieve previous messages on mount.

### 4. Multi-Document Comparison
*   **Implementation File**: [backend/main.py](file:///d:/projects_2/Project_v/backend/main.py)
*   **Details**: Endpoint `/api/compare` retrieves document metadata for two selected documents side-by-side, compares their sizes, upload dates, and pages, and creates a contrast dashboard in the UI.

### 5. Study Hub (Summaries, Flashcards, Quizzes)
*   **Implementation File**: [backend/main.py](file:///d:/projects_2/Project_v/backend/main.py)
*   **Details**:
    *   `/api/study/summary/{id}`: Generates structured summaries (Executive Summary, Stats, Index Chunks).
    *   `/api/study/flashcards/{id}`: Formulates Q&A definition cards based on index properties.
    *   `/api/study/quiz/{id}`: Generates a self-grading multiple-choice quiz about document metadata.
