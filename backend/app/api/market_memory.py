from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.services.ignore_rules import filter_ignored_tracked_items, get_active_ignore_rules
from app.services.market_memory import build_market_memory_map
from app.utils.realms import get_realm_display_name
from database import get_db
from models import TrackedItem

router = APIRouter(
    prefix="/api",
    tags=["Market Memory"],
)


def build_memory_summary(items: list[dict]) -> dict:
    return {
        "item_count": len(items),
        "deep_undervalued_count": len(
            [item for item in items if item["price_state"] == "Deep Undervalued"]
        ),
        "undervalued_count": len(
            [item for item in items if item["price_state"] == "Undervalued"]
        ),
        "below_normal_count": len(
            [item for item in items if item["price_state"] == "Below Normal"]
        ),
        "fair_value_count": len(
            [item for item in items if item["price_state"] == "Fair Value"]
        ),
        "overpriced_count": len(
            [item for item in items if item["price_state"] == "Overpriced"]
        ),
        "volatile_count": len(
            [item for item in items if item["price_state"] == "Volatile"]
        ),
        "learning_count": len(
            [item for item in items if item["price_state"] == "Learning"]
        ),
        "high_confidence_count": len(
            [item for item in items if item["memory_confidence"] == "High"]
        ),
        "medium_confidence_count": len(
            [item for item in items if item["memory_confidence"] == "Medium"]
        ),
        "low_confidence_count": len(
            [item for item in items if item["memory_confidence"] == "Low"]
        ),
    }


@router.get("/market-memory/summary")
async def get_market_memory_summary(
    connected_realm_id: int = Query(default=11),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    try:
        realm_name = await get_realm_display_name(connected_realm_id)

        tracked_result = await db.execute(
            select(TrackedItem)
            .where(TrackedItem.realm_id == connected_realm_id)
            .order_by(
                TrackedItem.opportunity_score.desc(),
                TrackedItem.volume.desc(),
                TrackedItem.current_price.desc(),
            )
            .limit(limit)
        )

        tracked_items = tracked_result.scalars().all()

        ignore_rules = await get_active_ignore_rules(
            db=db,
            connected_realm_id=connected_realm_id,
        )

        tracked_items, ignored_count = filter_ignored_tracked_items(
            tracked_items,
            ignore_rules,
        )

        memory_map = await build_market_memory_map(
            db=db,
            connected_realm_id=connected_realm_id,
            items=tracked_items,
            days=30,
        )

        memory_items = []

        for item in tracked_items:
            memory = memory_map.get(item.item_id)

            if not memory:
                continue

            memory_items.append(
                {
                    "item_id": item.item_id,
                    "realm_id": item.realm_id,
                    "name": item.name,
                    "current_price": item.current_price,
                    "volume": item.volume,
                    "listing_count": item.listing_count,
                    "opportunity_score": item.opportunity_score,
                    "risk_level": item.risk_level,
                    "icon_url": item.icon_url,
                    "quality": item.quality,
                    "goldsmith_category": item.goldsmith_category,
                    **memory,
                }
            )

        memory_items.sort(
            key=lambda item: (
                item["price_state"] not in ["Deep Undervalued", "Undervalued"],
                -item["memory_score"],
                -item["sample_count"],
                item["volatility_score"],
            )
        )

        return {
            "status": "Success",
            "connected_realm_id": connected_realm_id,
            "realm": realm_name,
            "ignored_count": ignored_count,
            "summary": build_memory_summary(memory_items),
            "top_undervalued": [
                item
                for item in memory_items
                if item["price_state"] in ["Deep Undervalued", "Undervalued", "Below Normal"]
            ][:10],
            "top_volatile": [
                item
                for item in sorted(
                    memory_items,
                    key=lambda memory_item: memory_item["volatility_score"],
                    reverse=True,
                )
                if item["sample_count"] >= 3
            ][:10],
            "items": memory_items[:limit],
        }

    except Exception as error:
        return {
            "status": "Error",
            "connected_realm_id": connected_realm_id,
            "realm": f"Connected Realm {connected_realm_id}",
            "error": str(error),
            "ignored_count": 0,
            "summary": build_memory_summary([]),
            "top_undervalued": [],
            "top_volatile": [],
            "items": [],
        }
