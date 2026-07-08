from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models import TrackedItem

router = APIRouter(
    prefix="/api",
    tags=["Dashboard"],
)

REALM_NAMES = {
    11: "Illidan",
    4: "Area 52",
    12: "Sargeras",
    53: "Tichondrius",
}


@router.get("/dashboard")
async def get_dashboard_data(
    connected_realm_id: int = Query(default=11),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(TrackedItem)
            .where(TrackedItem.realm_id == connected_realm_id)
            .order_by(TrackedItem.opportunity_score.desc())
        )

        items = result.scalars().all()

        return {
            "status": "Success",
            "connected_realm_id": connected_realm_id,
            "realm": REALM_NAMES.get(
                connected_realm_id,
                f"Connected Realm {connected_realm_id}",
            ),
            "item_count": len(items),
            "items": [
                {
                    "id": item.id,
                    "item_id": item.item_id,
                    "name": item.name,
                    "current_price": item.current_price,
                    "volume": item.volume,
                    "listing_count": item.listing_count,
                    "opportunity_score": item.opportunity_score,
                    "risk_level": item.risk_level,
                    "reason": item.reason,
                    "icon_url": item.icon_url,
                    "quality": item.quality,
                    "profit_margin": item.profit_margin,
                }
                for item in items
            ],
        }

    except Exception as error:
        return {
            "status": "Error",
            "connected_realm_id": connected_realm_id,
            "error": str(error),
        }