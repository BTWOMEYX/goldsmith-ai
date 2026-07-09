from pydantic import BaseModel
from fastapi import APIRouter, Depends
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.utils.realms import get_realm_display_name
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
    volume: int
    listing_count: int
    opportunity_score: float
    risk_level: str
    reason: str | None = None
    icon_url: str | None = None
    quality: str | None = None
    item_class: str | None = None
    item_subclass: str | None = None
    goldsmith_category: str = "Unknown / Other"
    profit_margin: float = 0


async def serialize_watchlist_item(item: WatchlistItem) -> dict:
    display_realm_name = await get_realm_display_name(item.realm_id)

    return {
        "id": item.id,
        "item_id": item.item_id,
        "realm_id": item.realm_id,
        "realm_name": display_realm_name,
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
        "saved_at": item.created_at.isoformat()
        if item.created_at
        else None,
    }


@router.get("/watchlist")
async def get_watchlist(db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(
            select(WatchlistItem)
            .order_by(WatchlistItem.created_at.desc())
        )

        items = result.scalars().all()

        serialized_items = [
            await serialize_watchlist_item(item)
            for item in items
        ]

        return {
            "status": "Success",
            "item_count": len(serialized_items),
            "items": serialized_items,
        }

    except Exception as error:
        return {
            "status": "Error",
            "item_count": 0,
            "items": [],
            "error": str(error),
        }


@router.post("/watchlist")
async def add_to_watchlist(
    payload: WatchlistItemPayload,
    db: AsyncSession = Depends(get_db),
):
    try:
        display_realm_name = await get_realm_display_name(payload.realm_id)

        existing_result = await db.execute(
            select(WatchlistItem).where(
                WatchlistItem.item_id == payload.item_id,
                WatchlistItem.realm_id == payload.realm_id,
            )
        )

        existing_item = existing_result.scalars().first()

        if existing_item:
            existing_item.realm_name = display_realm_name
            existing_item.name = payload.name
            existing_item.current_price = payload.current_price
            existing_item.volume = payload.volume
            existing_item.listing_count = payload.listing_count
            existing_item.opportunity_score = payload.opportunity_score
            existing_item.risk_level = payload.risk_level
            existing_item.reason = payload.reason
            existing_item.icon_url = payload.icon_url
            existing_item.quality = payload.quality
            existing_item.item_class = payload.item_class
            existing_item.item_subclass = payload.item_subclass
            existing_item.goldsmith_category = payload.goldsmith_category
            existing_item.profit_margin = payload.profit_margin

            await db.commit()
            await db.refresh(existing_item)

            return {
                "status": "Success",
                "message": "Watchlist item updated.",
                "item": await serialize_watchlist_item(existing_item),
            }

        new_item = WatchlistItem(
            item_id=payload.item_id,
            realm_id=payload.realm_id,
            realm_name=display_realm_name,
            name=payload.name,
            current_price=payload.current_price,
            volume=payload.volume,
            listing_count=payload.listing_count,
            opportunity_score=payload.opportunity_score,
            risk_level=payload.risk_level,
            reason=payload.reason,
            icon_url=payload.icon_url,
            quality=payload.quality,
            item_class=payload.item_class,
            item_subclass=payload.item_subclass,
            goldsmith_category=payload.goldsmith_category,
            profit_margin=payload.profit_margin,
        )

        db.add(new_item)

        await db.commit()
        await db.refresh(new_item)

        return {
            "status": "Success",
            "message": "Item added to watchlist.",
            "item": await serialize_watchlist_item(new_item),
        }

    except Exception as error:
        await db.rollback()

        return {
            "status": "Error",
            "message": "Unable to add item to watchlist.",
            "error": str(error),
        }


@router.delete("/watchlist/{realm_id}/{item_id}")
async def remove_from_watchlist(
    realm_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
):
    try:
        await db.execute(
            delete(WatchlistItem).where(
                WatchlistItem.realm_id == realm_id,
                WatchlistItem.item_id == item_id,
            )
        )

        await db.commit()

        return {
            "status": "Success",
            "message": "Item removed from watchlist.",
            "realm_id": realm_id,
            "item_id": item_id,
        }

    except Exception as error:
        await db.rollback()

        return {
            "status": "Error",
            "message": "Unable to remove item from watchlist.",
            "error": str(error),
        }


@router.delete("/watchlist")
async def clear_watchlist(db: AsyncSession = Depends(get_db)):
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
            "message": "Unable to clear watchlist.",
            "error": str(error),
        }