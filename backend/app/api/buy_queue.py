from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.utils.realms import get_realm_display_name
from database import get_db
from models import BuyQueueItem

router = APIRouter(
    prefix="/api",
    tags=["Buy Queue"],
)


ALLOWED_STATUSES = {
    "queued",
    "bought",
    "skipped",
}


class BuyQueueFromAlertPayload(BaseModel):
    item_id: int
    realm_id: int
    realm_name: str | None = None

    item_name: str
    category: str | None = None
    icon_url: str | None = None
    quality: str | None = None

    decision_grade: str | None = None
    final_decision: str | None = None
    decision_score: float = 0
    buy_pressure: str | None = None
    position_size_label: str | None = None

    signal: str | None = None
    memory_price_state: str | None = None

    suggested_quantity: int = Field(default=1, ge=0)
    max_price_each: float = Field(default=0, ge=0)
    target_sale_price_each: float = Field(default=0, ge=0)
    expected_margin_percent: float = 0

    reason: str | None = None
    notes: str | None = None


class MarkBoughtPayload(BaseModel):
    bought_quantity: int = Field(default=1, ge=1)
    bought_price_each: float = Field(default=0, ge=0)
    notes: str | None = None


class QueueStatusPayload(BaseModel):
    status: str
    notes: str | None = None


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def serialize_queue_item(item: BuyQueueItem) -> dict:
    return {
        "id": item.id,
        "item_id": item.item_id,
        "realm_id": item.realm_id,
        "realm_name": item.realm_name,
        "item_name": item.item_name,
        "category": item.category,
        "icon_url": item.icon_url,
        "quality": item.quality,
        "decision_grade": item.decision_grade,
        "final_decision": item.final_decision,
        "decision_score": item.decision_score,
        "buy_pressure": item.buy_pressure,
        "position_size_label": item.position_size_label,
        "signal": item.signal,
        "memory_price_state": item.memory_price_state,
        "suggested_quantity": item.suggested_quantity,
        "max_price_each": item.max_price_each,
        "max_total_spend": item.max_total_spend,
        "target_sale_price_each": item.target_sale_price_each,
        "expected_profit_each": item.expected_profit_each,
        "expected_total_profit": item.expected_total_profit,
        "expected_margin_percent": item.expected_margin_percent,
        "status": item.status,
        "bought_quantity": item.bought_quantity,
        "bought_price_each": item.bought_price_each,
        "total_buy_cost": item.total_buy_cost,
        "reason": item.reason,
        "notes": item.notes,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        "bought_at": item.bought_at.isoformat() if item.bought_at else None,
    }


def build_summary(items: list[BuyQueueItem]) -> dict:
    queued_items = [item for item in items if item.status == "queued"]
    bought_items = [item for item in items if item.status == "bought"]
    skipped_items = [item for item in items if item.status == "skipped"]

    return {
        "total_count": len(items),
        "queued_count": len(queued_items),
        "bought_count": len(bought_items),
        "skipped_count": len(skipped_items),
        "queued_max_spend": round(sum(item.max_total_spend for item in queued_items), 2),
        "bought_total_cost": round(sum(item.total_buy_cost for item in bought_items), 2),
        "expected_total_profit": round(sum(item.expected_total_profit for item in queued_items), 2),
    }


def calculate_queue_numbers(payload: BuyQueueFromAlertPayload) -> dict:
    quantity = max(int(payload.suggested_quantity or 0), 0)
    max_price_each = round(float(payload.max_price_each or 0), 2)
    target_sale_price_each = round(float(payload.target_sale_price_each or 0), 2)

    max_total_spend = round(quantity * max_price_each, 2)
    expected_profit_each = round(target_sale_price_each - max_price_each, 2)
    expected_total_profit = round(expected_profit_each * quantity, 2)

    return {
        "suggested_quantity": quantity,
        "max_price_each": max_price_each,
        "target_sale_price_each": target_sale_price_each,
        "max_total_spend": max_total_spend,
        "expected_profit_each": expected_profit_each,
        "expected_total_profit": expected_total_profit,
    }


@router.get("/buy-queue")
async def get_buy_queue(
    connected_realm_id: int | None = Query(default=None),
    status: str = Query(default="queued"),
    db: AsyncSession = Depends(get_db),
):
    query = select(BuyQueueItem)

    if connected_realm_id is not None:
        query = query.where(BuyQueueItem.realm_id == connected_realm_id)

    if status != "all":
        query = query.where(BuyQueueItem.status == status)

    result = await db.execute(
        query.order_by(
            BuyQueueItem.created_at.desc(),
            BuyQueueItem.decision_score.desc(),
        )
    )

    items = list(result.scalars().all())

    return {
        "status": "Success",
        "summary": build_summary(items),
        "items": [serialize_queue_item(item) for item in items],
    }


@router.post("/buy-queue/from-alert")
async def add_from_alert(
    payload: BuyQueueFromAlertPayload,
    db: AsyncSession = Depends(get_db),
):
    if payload.suggested_quantity <= 0:
        return {
            "status": "Error",
            "error": "Suggested quantity must be greater than zero.",
            "item": None,
        }

    realm_name = payload.realm_name or await get_realm_display_name(payload.realm_id)
    numbers = calculate_queue_numbers(payload)

    existing_result = await db.execute(
        select(BuyQueueItem).where(
            BuyQueueItem.item_id == payload.item_id,
            BuyQueueItem.realm_id == payload.realm_id,
            BuyQueueItem.status == "queued",
        )
    )

    existing_item = existing_result.scalars().first()

    if existing_item:
        existing_item.realm_name = realm_name
        existing_item.item_name = payload.item_name
        existing_item.category = payload.category
        existing_item.icon_url = payload.icon_url
        existing_item.quality = payload.quality
        existing_item.decision_grade = payload.decision_grade
        existing_item.final_decision = payload.final_decision
        existing_item.decision_score = payload.decision_score
        existing_item.buy_pressure = payload.buy_pressure
        existing_item.position_size_label = payload.position_size_label
        existing_item.signal = payload.signal
        existing_item.memory_price_state = payload.memory_price_state
        existing_item.suggested_quantity = numbers["suggested_quantity"]
        existing_item.max_price_each = numbers["max_price_each"]
        existing_item.max_total_spend = numbers["max_total_spend"]
        existing_item.target_sale_price_each = numbers["target_sale_price_each"]
        existing_item.expected_profit_each = numbers["expected_profit_each"]
        existing_item.expected_total_profit = numbers["expected_total_profit"]
        existing_item.expected_margin_percent = payload.expected_margin_percent
        existing_item.reason = payload.reason
        existing_item.notes = payload.notes
        existing_item.updated_at = utc_now()

        await db.commit()
        await db.refresh(existing_item)

        return {
            "status": "Success",
            "action": "updated",
            "item": serialize_queue_item(existing_item),
        }

    new_item = BuyQueueItem(
        item_id=payload.item_id,
        realm_id=payload.realm_id,
        realm_name=realm_name,
        item_name=payload.item_name,
        category=payload.category,
        icon_url=payload.icon_url,
        quality=payload.quality,
        decision_grade=payload.decision_grade,
        final_decision=payload.final_decision,
        decision_score=payload.decision_score,
        buy_pressure=payload.buy_pressure,
        position_size_label=payload.position_size_label,
        signal=payload.signal,
        memory_price_state=payload.memory_price_state,
        suggested_quantity=numbers["suggested_quantity"],
        max_price_each=numbers["max_price_each"],
        max_total_spend=numbers["max_total_spend"],
        target_sale_price_each=numbers["target_sale_price_each"],
        expected_profit_each=numbers["expected_profit_each"],
        expected_total_profit=numbers["expected_total_profit"],
        expected_margin_percent=payload.expected_margin_percent,
        status="queued",
        reason=payload.reason,
        notes=payload.notes,
    )

    db.add(new_item)

    await db.commit()
    await db.refresh(new_item)

    return {
        "status": "Success",
        "action": "created",
        "item": serialize_queue_item(new_item),
    }


@router.patch("/buy-queue/{queue_item_id}/mark-bought")
async def mark_bought(
    queue_item_id: int,
    payload: MarkBoughtPayload,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BuyQueueItem).where(BuyQueueItem.id == queue_item_id)
    )

    item = result.scalars().first()

    if not item:
        return {
            "status": "Error",
            "error": "Buy queue item not found.",
            "item": None,
        }

    item.status = "bought"
    item.bought_quantity = payload.bought_quantity
    item.bought_price_each = round(payload.bought_price_each, 2)
    item.total_buy_cost = round(payload.bought_quantity * payload.bought_price_each, 2)
    item.notes = payload.notes or item.notes
    item.bought_at = utc_now()
    item.updated_at = utc_now()

    await db.commit()
    await db.refresh(item)

    return {
        "status": "Success",
        "item": serialize_queue_item(item),
    }


@router.patch("/buy-queue/{queue_item_id}/status")
async def update_queue_status(
    queue_item_id: int,
    payload: QueueStatusPayload,
    db: AsyncSession = Depends(get_db),
):
    new_status = payload.status.lower().strip()

    if new_status not in ALLOWED_STATUSES:
        return {
            "status": "Error",
            "error": f"Status must be one of: {', '.join(sorted(ALLOWED_STATUSES))}.",
            "item": None,
        }

    result = await db.execute(
        select(BuyQueueItem).where(BuyQueueItem.id == queue_item_id)
    )

    item = result.scalars().first()

    if not item:
        return {
            "status": "Error",
            "error": "Buy queue item not found.",
            "item": None,
        }

    item.status = new_status
    item.notes = payload.notes or item.notes
    item.updated_at = utc_now()

    await db.commit()
    await db.refresh(item)

    return {
        "status": "Success",
        "item": serialize_queue_item(item),
    }


@router.delete("/buy-queue/{queue_item_id}")
async def delete_queue_item(
    queue_item_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BuyQueueItem).where(BuyQueueItem.id == queue_item_id)
    )

    item = result.scalars().first()

    if not item:
        return {
            "status": "Error",
            "error": "Buy queue item not found.",
        }

    await db.delete(item)
    await db.commit()

    return {
        "status": "Success",
        "deleted_id": queue_item_id,
    }
