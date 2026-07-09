from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.utils.realms import get_realm_display_name
from database import get_db
from models import TrackedItem

router = APIRouter(
    prefix="/api",
    tags=["Dashboard"],
)


def serialize_tracked_item(item: TrackedItem) -> dict:
    return {
        "id": item.id,
        "item_id": item.item_id,
        "realm_id": item.realm_id,
        "name": item.name,
        "current_price": item.current_price,
        "volume": item.volume,
        "listing_count": item.listing_count,
        "opportunity_score": item.opportunity_score,
        "risk_level": item.risk_level,
        "reason": item.reason,
        "icon_url": item.icon_url,
        "quality": item.quality,
        "item_class": item.item_class,
        "item_subclass": item.item_subclass,
        "goldsmith_category": item.goldsmith_category,
        "profit_margin": item.profit_margin,
        "created_at": item.created_at.isoformat()
        if item.created_at
        else None,
    }


@router.get("/dashboard")
async def get_dashboard(
    connected_realm_id: int = Query(default=11),
    db: AsyncSession = Depends(get_db),
):
    try:
        realm_name = await get_realm_display_name(connected_realm_id)

        result = await db.execute(
            select(TrackedItem)
            .where(TrackedItem.realm_id == connected_realm_id)
            .order_by(
                TrackedItem.opportunity_score.desc(),
                TrackedItem.volume.desc(),
                TrackedItem.current_price.desc(),
            )
        )

        tracked_items = result.scalars().all()

        return {
            "status": "Success",
            "connected_realm_id": connected_realm_id,
            "realm": realm_name,
            "item_count": len(tracked_items),
            "items": [
                serialize_tracked_item(item)
                for item in tracked_items
            ],
        }

    except Exception as error:
        return {
            "status": "Error",
            "connected_realm_id": connected_realm_id,
            "realm": f"Connected Realm {connected_realm_id}",
            "item_count": 0,
            "items": [],
            "error": str(error),
        }