from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from database import engine
from models import Base

from app.api.health import router as health_router
from app.api.dashboard import router as dashboard_router
from app.api.sync import router as sync_router

# Locate backend root absolute path and force load variables down to all submodules
backend_root = Path(__file__).resolve().parent.parent
load_dotenv(backend_root / ".env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initializes PostgreSQL schemas dynamically on engine spinup if missing
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="GoldSmith AI Live Engine Pro",
    version="1.0.0",
    lifespan=lifespan,
)

# Lock down resource sharing rules to prevent browser pre-flight execution rejections
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Dev environment
        "http://localhost:4173",  # Production preview
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register feature layout sub-routes
app.include_router(health_router)
app.include_router(dashboard_router)
app.include_router(sync_router)


@app.get("/")
async def root():
    return {
        "application": "GoldSmith AI",
        "status": "running",
        "version": "1.0.0",
    }