from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models import WatchlistItem

router = APIRouter(
    prefix="/api",
    tags=["Watchlist"],
)


class WatchlistItemPayload(BaseModel):
    item_id: int
    realm_id: int
    realm_name: str

    name: str
    current_price: float

    volume: int = 0
    listing_count: int = 0

    opportunity_score: float = 0
    risk_level: str = "Unknown"
    reason: str | None = None

    icon_url: str | None = None
    quality: str | None = None

    profit_margin: float = 0


def serialize_watchlist_item(item: WatchlistItem) -> dict:
    return {
        "id": item.id,
        "item_id": item.item_id,
        "realm_id": item.realm_id,
        "realm_name": item.realm_name,
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
        "saved_at": item.created_at.isoformat() if item.created_at else None,
    }


@router.get("/watchlist")
async def get_watchlist(
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(WatchlistItem).order_by(WatchlistItem.created_at.desc())
        )

        items = result.scalars().all()

        return {
            "status": "Success",
            "item_count": len(items),
            "items": [
                serialize_watchlist_item(item)
                for item in items
            ],
        }

    except Exception as error:
        return {
            "status": "Error",
            "error": str(error),
        }


@router.post("/watchlist")
async def add_watchlist_item(
    payload: WatchlistItemPayload,
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(WatchlistItem).where(
                WatchlistItem.item_id == payload.item_id,
                WatchlistItem.realm_id == payload.realm_id,
            )
        )

        existing_item = result.scalar_one_or_none()

        if existing_item:
            existing_item.realm_name = payload.realm_name
            existing_item.name = payload.name
            existing_item.current_price = payload.current_price
            existing_item.volume = payload.volume
            existing_item.listing_count = payload.listing_count
            existing_item.opportunity_score = payload.opportunity_score
            existing_item.risk_level = payload.risk_level
            existing_item.reason = payload.reason
            existing_item.icon_url = payload.icon_url
            existing_item.quality = payload.quality
            existing_item.profit_margin = payload.profit_margin

            await db.commit()
            await db.refresh(existing_item)

            return {
                "status": "Updated",
                "item": serialize_watchlist_item(existing_item),
            }

        new_item = WatchlistItem(
            item_id=payload.item_id,
            realm_id=payload.realm_id,
            realm_name=payload.realm_name,
            name=payload.name,
            current_price=payload.current_price,
            volume=payload.volume,
            listing_count=payload.listing_count,
            opportunity_score=payload.opportunity_score,
            risk_level=payload.risk_level,
            reason=payload.reason,
            icon_url=payload.icon_url,
            quality=payload.quality,
            profit_margin=payload.profit_margin,
        )

        db.add(new_item)

        await db.commit()
        await db.refresh(new_item)

        return {
            "status": "Saved",
            "item": serialize_watchlist_item(new_item),
        }

    except Exception as error:
        await db.rollback()

        return {
            "status": "Error",
            "error": str(error),
        }


@router.delete("/watchlist")
async def clear_watchlist(
    db: AsyncSession = Depends(get_db),
):
    try:
        await db.execute(delete(WatchlistItem))
        await db.commit()

        return {
            "status": "Success",
            "message": "Watchlist cleared.",
        }

    except Exception as error:
        await db.rollback()

        return {
            "status": "Error",
            "error": str(error),
        }


@router.delete("/watchlist/{realm_id}/{item_id}")
async def remove_watchlist_item(
    realm_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await db.execute(
            select(WatchlistItem).where(
                WatchlistItem.item_id == item_id,
                WatchlistItem.realm_id == realm_id,
            )
        )

        item = result.scalar_one_or_none()

        if not item:
            return {
                "status": "Not Found",
                "message": "Item was not in the watchlist.",
            }

        await db.delete(item)
        await db.commit()

        return {
            "status": "Success",
            "message": "Item removed from watchlist.",
            "item_id": item_id,
            "realm_id": realm_id,
        }

    except Exception as error:
        await db.rollback()

        return {
            "status": "Error",
            "error": str(error),
        }