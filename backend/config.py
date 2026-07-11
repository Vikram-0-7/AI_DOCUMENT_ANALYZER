import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # App General Settings
    APP_NAME: str = "DocMind AI API"
    DEBUG: bool = True
    
    # API Credentials
    GROQ_API_KEY: str = Field(default="", env="GROQ_API_KEY")
    
    # Vector Database Settings
    CHROMA_DB_PATH: str = Field(default="./chroma_db", env="CHROMA_DB_PATH")
    CHROMA_COLLECTION_NAME: str = "docmind_collection"
    
    # Relational Database Settings (SQLAlchemy)
    # Default to local postgresql, fall back to sqlite if postgresql is unavailable
    DATABASE_URL: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/docmind",
        env="DATABASE_URL"
    )
    
    # Redis & Celery broker
    REDIS_URL: str = Field(default="redis://localhost:6379/0", env="REDIS_URL")
    
    # Embedding Model Name
    EMBEDDING_MODEL_NAME: str = "BAAI/bge-base-en-v1.5"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Post-processing settings for safe SQLite fallback if PostgreSQL driver psycopg2 isn't ready
if not settings.DATABASE_URL.startswith("postgresql") and not settings.DATABASE_URL.startswith("sqlite"):
    settings.DATABASE_URL = "sqlite:///./docmind.db"
