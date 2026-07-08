import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from typing import List

# Fix the import path drift so Python can see files at the root level
backend_root = Path(__file__).resolve().parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.services.blizzard import blizzard_service
from database import get_db, engine
from models import TrackedItem, Base

# ---------------------------------------------------------
# LIFESPAN: Automatic Table Creation on Startup
# ---------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # This reads your models.py file and creates the "tracked_items" table if it doesn't exist yet
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

# Initialize your FastAPI application
app = FastAPI(title="Goldsmith AI API", lifespan=lifespan)

# ---------------------------------------------------------
# CORS MIDDLEWARE: Allows Frontend Connection
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows your React frontend dev server to connect
    allow_credentials=True,
    allow_methods=["*"],  # Allows GET, POST, OPTIONS, etc.
    allow_headers=["*"],
)

# WoW Item IDs we want to track
TRACKED_ITEM_IDS = [225449, 173202, 173204] 

ITEM_NAMES = {
    225449: "Sample Alloy / Item",
    173202: "Shadowghast Ingot",
    173204: "Elethium Ore"
}

# ---------------------------------------------------------
# ROUTE 1: Diagnostic Test (Read-Only)
# ---------------------------------------------------------
@app.get("/api/test-blizzard")
async def test_blizzard():
    """
    Temporary diagnostic endpoint to verify Blizzard API connectivity.
    """
    try:
        data = await blizzard_service.get_auction_house_data(connected_realm_id=11)
        total_auctions = len(data.get("auctions", []))
        return {
            "status": "Success! Connected to Blizzard Grid.",
            "total_active_listings": total_auctions,
            "sample_item": data["auctions"][0] if total_auctions > 0 else "No listings found"
        }
    except Exception as e:
        return {"status": "Failed to connect", "error": str(e)}

# ---------------------------------------------------------
# ROUTE 2: Database Sync (Write to PostgreSQL)
# ---------------------------------------------------------
@app.post("/api/sync-auctions")
async def sync_auctions(db: AsyncSession = Depends(get_db)):
    """
    Fetches live AH data, calculates lowest buyout prices, and saves/updates them in the database.
    """
    try:
        # 1. Fetch live auction house data
        data = await blizzard_service.get_auction_house_data(connected_realm_id=11)
        auctions = data.get("auctions", [])
        
        # 2. Find the lowest buyout price for each tracked item
        cheapest_prices = {}
        for auction in auctions:
            item_id = auction.get("item", {}).get("id")
            if item_id in TRACKED_ITEM_IDS:
                buyout = auction.get("buyout") or auction.get("unit_price", 0)
                price_gold = buyout / 10000
                
                if price_gold > 0:
                    if item_id not in cheapest_prices or price_gold < cheapest_prices[item_id]:
                        cheapest_prices[item_id] = price_gold

        updated_count = 0
        
        # 3. Upsert into database (Update if exists, Insert if new)
        for item_id, lowest_price in cheapest_prices.items():
            result = await db.execute(select(TrackedItem).where(TrackedItem.item_id == item_id))
            db_item = result.scalars().first()
            
            if db_item:
                # Item exists, update its current price
                db_item.current_price = lowest_price
            else:
                # Item is new, insert it into the table
                new_item = TrackedItem(
                    item_id=item_id,
                    name=ITEM_NAMES.get(item_id, f"Unknown Item ({item_id})"),
                    current_price=lowest_price,
                    profit_margin=0.0
                )
                db.add(new_item)
                
            updated_count += 1
            
        # 4. Commit to PostgreSQL
        await db.commit()
        
        return {
            "status": "Sync Complete",
            "items_processed": updated_count,
            "current_market_prices": cheapest_prices
        }
        
    except Exception as e:
        await db.rollback()
        return {"status": "Sync Failed", "error": str(e)}

# ---------------------------------------------------------
# ROUTE 3: Dashboard Data (Read from PostgreSQL)
# ---------------------------------------------------------
@app.get("/api/dashboard")
async def get_dashboard_data(db: AsyncSession = Depends(get_db)):
    """
    Returns all tracked items from the database to supply the frontend dashboard.
    """
    try:
        # Query all items from the tracked_items table
        result = await db.execute(select(TrackedItem))
        items = result.scalars().all()
        
        # Format the data cleanly for your React frontend
        dashboard_items = []
        for item in items:
            dashboard_items.append({
                "id": item.id,
                "item_id": item.item_id,
                "name": item.name,
                "current_price": item.current_price,
                "profit_margin": item.profit_margin
            })
            
        return {
            "status": "Success",
            "items": dashboard_items
        }
        
    except Exception as e:
        return {"status": "Error fetching dashboard data", "error": str(e)}