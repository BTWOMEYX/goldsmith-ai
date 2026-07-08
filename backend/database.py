import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from typing import AsyncGenerator

# In a real setup, we'd load this from a .env file
# Make sure you have a local Postgres server running with these credentials!
DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/goldsmith_db"

# Create the async engine
engine = create_async_engine(DATABASE_URL, echo=True)

# Create a session factory
SessionLocal = sessionmaker(
    bind=engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

# Declarative Base for our models to inherit from
Base = declarative_base()

# Dependency Injection for our FastAPI routes
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session