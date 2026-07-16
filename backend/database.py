import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import datetime
import json
from sqlalchemy import create_engine, Column, String, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from backend.config import settings

# Base class for SQLAlchemy schemas
Base = declarative_base()

# Configure engine. For SQLite, allow multiple thread context connections.
engine_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    engine_args = {"connect_args": {"check_same_thread": False}}

engine = create_engine(settings.DATABASE_URL, **engine_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ==========================================
# DATABASE SCHEMAS & MODELS
# ==========================================

class DocumentMetadata(Base):
    __tablename__ = "document_metadata"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    size = Column(String, nullable=False)
    upload_date = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="PROCESSING") # PROCESSING, INGESTED, ERROR
    pages = Column(Integer, default=0)

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    
    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    chat_session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False)
    sender = Column(String, nullable=False) # 'user' or 'ai'
    text = Column(String, nullable=False)
    citations = Column(JSON, nullable=True) # list of dict: docName, page, text
    steps = Column(JSON, nullable=True) # LangChain pipeline trace steps
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    session = relationship("ChatSession", back_populates="messages")

# Database session generator dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Create tables
def init_db():
    Base.metadata.create_all(bind=engine)
