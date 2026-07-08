import os
import httpx
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from app.services.blizzard import blizzard_service
from database import get_db
from models import TrackedItem

router = APIRouter(prefix="/api", tags=["sync"])

LOCAL_ITEM_REGISTRY = {
    240161: "Null Lotus",
    128313: "Furious Potion",
    219931: "Bismuth Ore (Tier 3)",
    219933: "Ironclaw Ore (Tier 3)",
    225369: "Gilded Alloy",
    15065:  "Ancient Leather",
    219932: "Aqirite Ore (Tier 3)",
    245772: "Arkhana Crystallite"
}

def resolve_item_name_natively(item_id: int) -> str:
    if item_id in LOCAL_ITEM_REGISTRY:
        return LOCAL_ITEM_REGISTRY[item_id]
    if 217000 <= item_id <= 217999 or 260000 <= item_id <= 261000:
        return f"Algari Competitor Asset {item_id}"
    return f"Khaz Algar Trade Gear {item_id}"


@router.post("/sync-auctions")
async def sync_auctions(
    realm_name: str = Query(default="illidan"),  # Accept clean string names dynamically
    db: AsyncSession = Depends(get_db)
):
    try:
        # 1. Standardize the target name into an API slug format
        target_slug = realm_name.lower().strip().replace(" ", "-").replace("'", "")
        print(f"[ENGINE RECON] Resolving live infrastructure node for realm: '{target_slug}'")
        
        # 2. Query Blizzard's official search index to find the exact connected-realm ID
        token = await blizzard_service.get_token()
        search_url = "https://us.api.blizzard.com/data/wow/search/connected-realm"
        
        async with httpx.AsyncClient() as client:
            search_response = await client.get(
                search_url,
                params={
                    "namespace": "dynamic-us",
                    "locale": "en_US",
                    "realms.slug": target_slug,
                    "access_token": token
                },
                timeout=10.0
            )
            
            if search_response.status_code != 200:
                return {"status": "Sync Aborted", "message": f"Blizzard Search Index failed: {search_response.text}"}
                
            search_data = search_response.json()
            
        results = search_data.get("results", [])
        if not results:
            print(f"[ENGINE ERROR] Server lookup failed. '{target_slug}' does not match any current Blizzard region maps.")
            return {"status": "Sync Aborted", "message": f"Realm '{realm_name}' not found in region grids."}
            
        # Extract the official dynamic ID returned straight from Blizzard
        resolved_realm_id = results[0]["data"]["id"]
        print(f"[ENGINE SUCCESS] Core match found! '{realm_name}' mapped to active dynamic ID: {resolved_realm_id}")
        
        # 3. Pull down the active live data using the verified ID
        data = await blizzard_service.get_auction_house_data(connected_realm_id=resolved_realm_id)
        if not data or "auctions" not in data:
            return {"status": "Sync Aborted", "message": f"Blizzard returned empty payload for resolved ID {resolved_realm_id}"}
            
        auctions = data.get("auctions", [])
        print(f"[ENGINE SUCCESS] Core file download complete. Total lines read: {len(auctions)}")
        
        # 4. Extract pricing metrics across entire dataset
        item_prices = {}
        item_volumes = {}

        for auction in auctions:
            item_id = auction.get("item", {}).get("id")
            if not item_id:
                continue
                
            buyout = auction.get("unit_price") or auction.get("buyout") or auction.get("bid", 0)
            price_gold = buyout / 10000

            if 5.0 <= price_gold <= 200000.0:
                if item_id not in item_prices or price_gold < item_prices[item_id]:
                    item_prices[item_id] = price_gold
                item_volumes[item_id] = item_volumes.get(item_id, 0) + 1

        # 5. Filter and score top margin flipped items
        valuable_items = []
        for item_id, price in item_prices.items():
            volume = item_volumes.get(item_id, 1)
            if volume > 5:
                profit_potential = round(price * 0.12, 2)  
                valuable_items.append({
                    "item_id": item_id,
                    "price": price,
                    "score": profit_potential
                })

        valuable_items.sort(key=lambda x: x["score"], reverse=True)
        top_opportunities = valuable_items[:15]

        # 6. Wipe obsolete transaction logs for this specific dynamic ID partition
        await db.execute(delete(TrackedItem).where(TrackedItem.realm_id == resolved_realm_id))
        await db.flush()

        # 7. Commit fresh rows into PostgreSQL
        for opp in top_opportunities:
            item_id = opp["item_id"]
            db.add(TrackedItem(
                item_id=item_id,
                realm_id=resolved_realm_id,
                name=resolve_item_name_natively(item_id),  
                current_price=opp["price"],
                profit_margin=opp["score"]
            ))
            
        await db.commit()
        print(f"[DATABASE SYSTEM] Data commit complete for '{realm_name}' (ID: {resolved_realm_id}).")
        
        return {
            "status": "Success", 
            "realm_monitored": realm_name,
            "resolved_internal_id": resolved_realm_id,
            "items_processed": len(item_prices)
        }
        
    except Exception as e:
        await db.rollback()
        print(f"[CRITICAL PIPELINE ERROR] Execution failed: {str(e)}") 
        return {"status": "Sync Failed", "error": str(e)}