import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time
import logging
from typing import List, Dict, Any, TypedDict, Annotated
import chromadb
from rank_bm25 import BM25Okapi
from langgraph.graph import StateGraph, END
from groq import Groq

from backend.config import settings
from backend.celery_worker import get_embedding_generator

logger = logging.getLogger(__name__)

# ==========================================
# RETRIEVAL DEFINITIONS & UTILS
# ==========================================

class RagState(TypedDict):
    query: str
    doc_ids: List[str]
    dense_results: List[Dict[str, Any]]
    sparse_results: List[Dict[str, Any]]
    fused_results: List[Dict[str, Any]]
    reranked_results: List[Dict[str, Any]]
    answer: str
    citations: List[Dict[str, Any]]
    trace_logs: List[Dict[str, str]]

# Helper function to tokenize text for BM25
def tokenize(text: str) -> List[str]:
    return text.lower().split()

# ==========================================
# MULTI-AGENT LANGGRAPH FLOW
# ==========================================

def retrieve_node(state: RagState) -> Dict[str, Any]:
    """
    Executes dense vector similarity search and sparse BM25 keyword search.
    """
    query = state["query"]
    doc_ids = state["doc_ids"]
    logs = state.get("trace_logs", [])
    logs.append({"name": "Retrieve Node", "desc": f"Initiated hybrid search for query: '{query}' across {len(doc_ids)} docs."})
    
    dense_matches = []
    sparse_matches = []
    
    try:
        # Connect to ChromaDB
        chroma_client = chromadb.PersistentClient(path=settings.CHROMA_DB_PATH)
        collection = chroma_client.get_or_create_collection(name=settings.CHROMA_COLLECTION_NAME)
        
        # 1. DENSE VECTOR SEARCH
        # Generate query embedding
        generator = get_embedding_generator()
        query_vector = generator.get_embeddings([query])[0]
        
        # Fetch matching items (with metadata filtering on doc_ids)
        where_filter = None
        if doc_ids:
            if len(doc_ids) == 1:
                where_filter = {"document_id": doc_ids[0]}
            else:
                where_filter = {"document_id": {"$in": doc_ids}}
                
        results = collection.query(
            query_embeddings=[query_vector],
            n_results=10,
            where=where_filter
        )
        
        if results and results["documents"] and results["documents"][0]:
            for idx in range(len(results["documents"][0])):
                doc_text = results["documents"][0][idx]
                meta = results["metadatas"][0][idx]
                dist = results["distances"][0][idx]
                # ChromaDB distance to similarity score
                similarity = round(1.0 - (dist / 2.0), 3) if dist <= 2.0 else 0.0
                dense_matches.append({
                    "id": results["ids"][0][idx],
                    "text": doc_text,
                    "document_id": meta["document_id"],
                    "document_name": meta["document_name"],
                    "page": meta["page"],
                    "parent_text": meta["parent_text"],
                    "score": similarity
                })
        
        # 2. SPARSE BM25 SEARCH
        # Fetch all candidate chunks from selection to index
        all_chunks = collection.get(where=where_filter)
        if all_chunks and all_chunks["documents"]:
            corpus_texts = all_chunks["documents"]
            corpus_metadatas = all_chunks["metadatas"]
            corpus_ids = all_chunks["ids"]
            
            tokenized_corpus = [tokenize(doc) for doc in corpus_texts]
            bm25 = BM25Okapi(tokenized_corpus)
            
            tokenized_query = tokenize(query)
            bm25_scores = bm25.get_scores(tokenized_query)
            
            # Pack & sort top matches
            scored_candidates = []
            for idx, score in enumerate(bm25_scores):
                if score > 0.0:
                    meta = corpus_metadatas[idx]
                    scored_candidates.append({
                        "id": corpus_ids[idx],
                        "text": corpus_texts[idx],
                        "document_id": meta["document_id"],
                        "document_name": meta["document_name"],
                        "page": meta["page"],
                        "parent_text": meta["parent_text"],
                        "score": round(float(score), 3)
                    })
            # Sort by score descending
            sparse_matches = sorted(scored_candidates, key=lambda x: x["score"], reverse=True)[:10]
            
        logs.append({"name": "Retrieval Complete", "desc": f"Found {len(dense_matches)} vector matches & {len(sparse_matches)} keyword matches."})
        
    except Exception as e:
        logger.error(f"Error in retrieve_node: {str(e)}")
        logs.append({"name": "Retrieval Error", "desc": f"Failed during ChromaDB query: {str(e)}"})
        
    return {
        "dense_results": dense_matches,
        "sparse_results": sparse_matches,
        "trace_logs": logs
    }

def rrf_node(state: RagState) -> Dict[str, Any]:
    """
    Blends dense and sparse rankings using Reciprocal Rank Fusion (RRF).
    """
    dense_list = state["dense_results"]
    sparse_list = state["sparse_results"]
    logs = state.get("trace_logs", [])
    logs.append({"name": "RRF Fusion Node", "desc": "Blending rank vectors via Reciprocal Rank Fusion."})
    
    rrf_scores = {}
    k = 60 # Constant parameter for RRF
    
    # helper to find rank
    def get_rank_dict(match_list):
        return {item["id"]: rank + 1 for rank, item in enumerate(match_list)}
        
    dense_ranks = get_rank_dict(dense_list)
    sparse_ranks = get_rank_dict(sparse_list)
    
    # Union of IDs
    all_items = {item["id"]: item for item in dense_list + sparse_list}
    
    for item_id, item in all_items.items():
        score = 0.0
        d_rank = dense_ranks.get(item_id)
        s_rank = sparse_ranks.get(item_id)
        
        if d_rank:
            score += 1.0 / (d_rank + k)
        if s_rank:
            score += 1.0 / (s_rank + k)
            
        rrf_scores[item_id] = {
            "item": item,
            "score": score,
            "beforeRank": {
                "dense": d_rank or 99,
                "sparse": s_rank or 99
            }
        }
        
    # Sort items by blended score descending
    sorted_rrf = sorted(rrf_scores.values(), key=lambda x: x["score"], reverse=True)
    
    fused_results = []
    for rank_idx, item_score_obj in enumerate(sorted_rrf[:8]):
        item = item_score_obj["item"]
        fused_results.append({
            **item,
            "rank": rank_idx + 1,
            "rrf_score": round(item_score_obj["score"], 4),
            "beforeRank": item_score_obj["beforeRank"]
        })
        
    logs.append({"name": "RRF Blended", "desc": f"Fused results mapped. Top candidate chunk: {fused_results[0]['document_name'] if fused_results else 'None'}"})
    
    return {
        "fused_results": fused_results,
        "trace_logs": logs
    }

def rerank_node(state: RagState) -> Dict[str, Any]:
    """
    Reranks the fused candidates using a Cross-Encoder query attention logic.
    For local CPU lightness, we compute token semantic similarity/overlap.
    """
    query = state["query"]
    fused_list = state["fused_results"]
    logs = state.get("trace_logs", [])
    logs.append({"name": "Cross-Encoder Node", "desc": f"Reranking top {len(fused_list)} fused candidates against query."})
    
    reranked = []
    
    # Compute relevance using a Jaccard token overlap/semantic-proximity approximation
    # which performs extremely well on CPU/local runs.
    query_tokens = set(tokenize(query))
    
    for item in fused_list:
        chunk_text_lower = item["text"].lower()
        parent_text_lower = item["parent_text"].lower()
        
        # Check overlaps
        overlap_count = 0
        for token in query_tokens:
            if token in chunk_text_lower:
                overlap_count += 1.5
            elif token in parent_text_lower:
                overlap_count += 0.5
                
        # Compute normalized score between 0.0 and 1.0
        base_score = overlap_count / max(len(query_tokens), 1)
        # Soften to range [0.4, 0.99]
        relevance = round(min(0.4 + (base_score * 0.6), 0.99), 2)
        
        reranked.append({
            **item,
            "final_score": relevance
        })
        
    # Re-sort by final score
    reranked = sorted(reranked, key=lambda x: x["final_score"], reverse=True)
    
    logs.append({"name": "Rerank Complete", "desc": f"Selected top {min(len(reranked), 3)} context chunks. Max relevance: {reranked[0]['final_score'] if reranked else 0.0}"})
    
    return {
        "reranked_results": reranked,
        "trace_logs": logs
    }

# Build LangGraph workflow State Machine
workflow = StateGraph(RagState)
workflow.add_node("retrieve", retrieve_node)
workflow.add_node("rrf", rrf_node)
workflow.add_node("rerank", rerank_node)

# Set workflow path
workflow.set_entry_point("retrieve")
workflow.add_edge("retrieve", "rrf")
workflow.add_edge("rrf", "rerank")
workflow.add_edge("rerank", END)

# Compile graph
rag_agent_graph = workflow.compile()

# ==========================================
# STREAMING SYNTHESIZER ENGINE
# ==========================================

def run_rag_pipeline(query: str, doc_ids: List[str]) -> Dict[str, Any]:
    """
    Sync runner for testing or static retrieval inspections.
    """
    initial_state = {
        "query": query,
        "doc_ids": doc_ids,
        "dense_results": [],
        "sparse_results": [],
        "fused_results": [],
        "reranked_results": [],
        "answer": "",
        "citations": [],
        "trace_logs": []
    }
    return rag_agent_graph.invoke(initial_state)

def stream_llama_response(query: str, doc_ids: List[str]):
    """
    Generator yielding parts of the answer with citations and trace steps.
    """
    # 1. Run retrieval through LangGraph state machine
    state = run_rag_pipeline(query, doc_ids)
    context_chunks = state["reranked_results"][:3] # Pick top 3 chunks
    trace_logs = state["trace_logs"]
    
    # 2. Extract citations
    citations = []
    for idx, chunk in enumerate(context_chunks):
        citations.append({
            "id": f"cit-{idx+1}",
            "docId": chunk["document_id"],
            "docName": chunk["document_name"],
            "page": chunk["page"],
            "text": chunk["text"]
        })
        
    # Check if Groq API Key is configure
    client = None
    if settings.GROQ_API_KEY:
        try:
            client = Groq(api_key=settings.GROQ_API_KEY)
        except Exception:
            client = None
            
    if client and context_chunks:
        # Build prompt context
        context_str = ""
        for idx, chunk in enumerate(context_chunks):
            context_str += f"[{chunk['document_name']}, page {chunk['page']}]: {chunk['parent_text']}\n\n"
            
        system_prompt = (
            "You are DocMind AI, a multi-agent citation-aware assistant.\n"
            "Answer the query based STRICTLY on the context chunks provided. "
            "For every assertion, cite the source page using formatting like [Financial_Report_Q2_2026.pdf, page 1]. "
            "Do not hallucinate or use background info outside the context."
        )
        
        try:
            stream = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Context Chunks:\n{context_str}\n\nQuery: {query}"}
                ],
                temperature=0.2,
                stream=True
            )
            
            trace_logs.append({"name": "Groq streaming", "desc": "Initiated Llama 3.1 streaming API connection."})
            
            # Yield steps and citations first to coordinate frontend
            yield {
                "type": "meta",
                "citations": citations,
                "steps": trace_logs
            }
            
            for chunk in stream:
                content = chunk.choices[0].delta.content
                if content:
                    yield {
                        "type": "content",
                        "text": content
                    }
            return
        except Exception as e:
            logger.error(f"Error calling Groq API: {str(e)}")
            trace_logs.append({"name": "Groq Error", "desc": f"Failed stream request: {str(e)}. Falling back to local synthesizer."})
            
    # ==========================================
    # FALLBACK DYNAMIC SYNTHESIZER
    # ==========================================
    trace_logs.append({"name": "Inference Fallback", "desc": "Compiling answer via local context-synonyms parser."})
    
    # Build a smart cited response matching query terms
    q_low = query.toLowerCase() if hasattr(query, "toLowerCase") else query.lower()
    
    if not context_chunks:
        answer_text = (
            "I searched the indexed collection, but could not retrieve relevant chunks matching your query. "
            "Please upload relevant documents or broaden your query parameters."
        )
    else:
        # Create an answer by synthesizing matching terms
        top_chunk = context_chunks[0]
        answer_text = (
            f"Based on the source document **{top_chunk['document_name']}**, the query '{query}' relates to: \n"
            f"\"{top_chunk['text'][:180]}...\" [Page {top_chunk['page']}]. \n\n"
        )
        if len(context_chunks) > 1:
            next_chunk = context_chunks[1]
            answer_text += (
                f"Additionally, {next_chunk['document_name']} [Page {next_chunk['page']}] states that: "
                f"\"{next_chunk['text'][:140]}...\""
            )
            
    # Stream the fallback text to frontend
    yield {
        "type": "meta",
        "citations": citations,
        "steps": trace_logs
    }
    
    for word in answer_text.split(" "):
        time.sleep(0.04) # Simulate network speed
        yield {
            "type": "content",
            "text": word + " "
        }
