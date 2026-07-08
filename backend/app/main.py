from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine
from models import Base

from app.api.health import router as health_router
from app.api.dashboard import router as dashboard_router
from app.api.sync import router as sync_router
from app.api.watchlist import router as watchlist_router
from app.api.history import router as history_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield


app = FastAPI(
    title="GoldSmith AI Live Engine Pro",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(dashboard_router)
app.include_router(sync_router)
app.include_router(watchlist_router)
app.include_router(history_router)


@app.get("/")
async def root():
    return {
        "application": "GoldSmith AI",
        "status": "running",
        "version": "1.0.0",
    }