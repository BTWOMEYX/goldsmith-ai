from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

from app.services.blizzard import blizzard_service
from database import get_db
from models import TrackedItem

router = APIRouter(
    prefix="/api",
    tags=["Sync"],
)

LOCAL_ITEM_REGISTRY = {
    240161: "Null Lotus",
    128313: "Furious Potion",
    219931: "Bismuth Ore (Tier 3)",
    219933: "Ironclaw Ore (Tier 3)",
    225369: "Gilded Alloy",
    15065: "Ancient Leather",
    219932: "Aqirite Ore (Tier 3)",
    245772: "Arkhana Crystallite",
    225449: "Sample Premium Alloy",
    173202: "Shadowghast Ingot",
    173204: "Elethium Ore",
}


def resolve_item_name(item_id: int) -> str:
    if item_id in LOCAL_ITEM_REGISTRY:
        return LOCAL_ITEM_REGISTRY[item_id]

    if 217000 <= item_id <= 217999:
        return f"Algari Competitor Asset {item_id}"

    if 260000 <= item_id <= 261000:
        return f"Algari Competitor Asset {item_id}"

    if item_id > 210000:
        return f"Khaz Algar Trade Gear {item_id}"

    return f"Premium Speculative Asset {item_id}"


@router.post("/sync-auctions")
async def sync_auctions(
    connected_realm_id: int = Query(default=11),
    db: AsyncSession = Depends(get_db),
):
    try:
        print(
            f"[SYNC] Starting auction sync for connected_realm_id={connected_realm_id}"
        )

        data = await blizzard_service.get_auction_house_data(
            connected_realm_id=connected_realm_id
        )

        if not data or "auctions" not in data:
            return {
                "status": "Sync Aborted",
                "message": "Invalid auction payload from Blizzard API.",
            }

        auctions = data.get("auctions", [])

        print(f"[SYNC] Auctions downloaded: {len(auctions)}")

        item_prices: dict[int, float] = {}
        item_volumes: dict[int, int] = {}

        for auction in auctions:
            item = auction.get("item", {})
            item_id = item.get("id")

            if not item_id:
                continue

            raw_price = (
                auction.get("unit_price")
                or auction.get("buyout")
                or auction.get("bid")
                or 0
            )

            if raw_price <= 0:
                continue

            price_gold = raw_price / 10000

            quantity = auction.get("quantity", 1)

            # Filter out junk listings and absurd outliers
            if 5.0 <= price_gold <= 200000.0:
                if item_id not in item_prices or price_gold < item_prices[item_id]:
                    item_prices[item_id] = price_gold

                item_volumes[item_id] = item_volumes.get(item_id, 0) + quantity

        valuable_items = []

        for item_id, price in item_prices.items():
            volume = item_volumes.get(item_id, 1)

            if volume > 5:
                estimated_profit = round(price * 0.12, 2)

                valuable_items.append(
                    {
                        "item_id": item_id,
                        "name": resolve_item_name(item_id),
                        "price": price,
                        "volume": volume,
                        "score": estimated_profit,
                    }
                )

        valuable_items.sort(
            key=lambda item: item["score"],
            reverse=True,
        )

        top_opportunities = valuable_items[:15]

        await db.execute(
            delete(TrackedItem).where(
                TrackedItem.realm_id == connected_realm_id
            )
        )

        await db.flush()

        for opportunity in top_opportunities:
            db.add(
                TrackedItem(
                    item_id=opportunity["item_id"],
                    realm_id=connected_realm_id,
                    name=opportunity["name"],
                    current_price=opportunity["price"],
                    profit_margin=opportunity["score"],
                )
            )

        await db.commit()

        print(
            f"[SYNC] Completed. Items scanned={len(item_prices)}, "
            f"opportunities={len(top_opportunities)}"
        )

        return {
            "status": "Success",
            "connected_realm_id": connected_realm_id,
            "auctions_downloaded": len(auctions),
            "items_scanned": len(item_prices),
            "opportunities_unlocked": len(top_opportunities),
        }

    except Exception as error:
        await db.rollback()

        print(f"[SYNC ERROR] {str(error)}")

        return {
            "status": "Sync Failed",
            "error": str(error),
        }