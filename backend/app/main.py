from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.action_center import router as action_center_router
from app.api.autopilot import router as autopilot_router
from app.api.buy_queue import router as buy_queue_router
from app.api.capture import router as capture_router
from app.api.dashboard import router as dashboard_router
from app.api.deals import router as deals_router
from app.api.health import router as health_router
from app.api.gold_plan import router as gold_plan_router
from app.api.ignore_rules import router as ignore_rules_router
from app.api.market_memory import router as market_memory_router
from app.api.performance_feedback import router as performance_feedback_router
from app.api.plan_item_actions import router as plan_item_actions_router
from app.api.history import router as history_router
from app.api.realms import router as realms_router
from app.api.sell_plan import router as sell_plan_router
from app.api.signals import router as signals_router
from app.api.sync import router as sync_router
from app.api.strategy import router as strategy_router
from app.api.sync_jobs import router as sync_jobs_router
from app.api.trades import router as trades_router
from app.api.watchlist import router as watchlist_router
from app.utils.schema import ensure_database_schema
from database import engine
from models import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await ensure_database_schema(conn)

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
app.include_router(gold_plan_router)
app.include_router(action_center_router)
app.include_router(autopilot_router)
app.include_router(buy_queue_router)
app.include_router(dashboard_router)
app.include_router(sync_router)
app.include_router(strategy_router)
app.include_router(sync_jobs_router)
app.include_router(trades_router)
app.include_router(watchlist_router)
app.include_router(history_router)
app.include_router(ignore_rules_router)
app.include_router(market_memory_router)
app.include_router(performance_feedback_router)
app.include_router(plan_item_actions_router)
app.include_router(signals_router)
app.include_router(realms_router)
app.include_router(sell_plan_router)
app.include_router(capture_router)
app.include_router(deals_router)


@app.get("/")
async def root():
    return {
        "application": "GoldSmith AI",
        "status": "running",
        "version": "1.0.0",
    }