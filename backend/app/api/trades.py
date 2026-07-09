from datetime import datetime, timezone
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models import BuyQueueItem, TradeEntry

router = APIRouter(
    prefix="/api",
    tags=["Profit Tracker"],
)


ALLOWED_TRADE_STATUSES = {
    "open",
    "sold",
    "cancelled",
    "failed",
}


class ManualTradePayload(BaseModel):
    item_id: int
    realm_id: int
    realm_name: str = "Unknown Realm"

    item_name: str
    category: str | None = None
    icon_url: str | None = None
    quality: str | None = None

    quantity_bought: int = Field(default=1, ge=1)
    buy_price_each: float = Field(default=0, ge=0)
    target_sale_price_each: float = Field(default=0, ge=0)

    decision_grade: str | None = None
    final_decision: str | None = None
    decision_score: float = 0
    signal: str | None = None
    memory_price_state: str | None = None

    notes: str | None = None


class MarkSoldPayload(BaseModel):
    quantity_sold: int = Field(default=1, ge=1)
    actual_sale_price_each: float = Field(default=0, ge=0)
    sale_fee_percent: float = Field(default=5, ge=0, le=100)
    notes: str | None = None


class TradeStatusPayload(BaseModel):
    status: str
    notes: str | None = None


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def calculate_expected_values(
    quantity: int,
    buy_price_each: float,
    target_sale_price_each: float,
) -> dict:
    total_buy_cost = round(quantity * buy_price_each, 2)
    expected_total_sale_value = round(quantity * target_sale_price_each, 2)
    expected_profit = round(expected_total_sale_value - total_buy_cost, 2)

    expected_roi_percent = (
        round((expected_profit / total_buy_cost) * 100, 2)
        if total_buy_cost > 0
        else 0
    )

    return {
        "total_buy_cost": total_buy_cost,
        "expected_total_sale_value": expected_total_sale_value,
        "expected_profit": expected_profit,
        "expected_roi_percent": expected_roi_percent,
    }


def calculate_realized_values(
    quantity_sold: int,
    actual_sale_price_each: float,
    sale_fee_percent: float,
    total_buy_cost: float,
) -> dict:
    gross_sale_value = round(quantity_sold * actual_sale_price_each, 2)
    sale_fee_value = round(gross_sale_value * (sale_fee_percent / 100), 2)
    net_sale_value = round(gross_sale_value - sale_fee_value, 2)
    realized_profit = round(net_sale_value - total_buy_cost, 2)

    roi_percent = (
        round((realized_profit / total_buy_cost) * 100, 2)
        if total_buy_cost > 0
        else 0
    )

    return {
        "gross_sale_value": gross_sale_value,
        "sale_fee_value": sale_fee_value,
        "net_sale_value": net_sale_value,
        "realized_profit": realized_profit,
        "roi_percent": roi_percent,
    }


def serialize_trade(trade: TradeEntry) -> dict:
    return {
        "id": trade.id,
        "buy_queue_item_id": trade.buy_queue_item_id,
        "item_id": trade.item_id,
        "realm_id": trade.realm_id,
        "realm_name": trade.realm_name,
        "item_name": trade.item_name,
        "category": trade.category,
        "icon_url": trade.icon_url,
        "quality": trade.quality,
        "quantity_bought": trade.quantity_bought,
        "buy_price_each": trade.buy_price_each,
        "total_buy_cost": trade.total_buy_cost,
        "target_sale_price_each": trade.target_sale_price_each,
        "expected_total_sale_value": trade.expected_total_sale_value,
        "expected_profit": trade.expected_profit,
        "expected_roi_percent": trade.expected_roi_percent,
        "quantity_sold": trade.quantity_sold,
        "actual_sale_price_each": trade.actual_sale_price_each,
        "gross_sale_value": trade.gross_sale_value,
        "sale_fee_percent": trade.sale_fee_percent,
        "sale_fee_value": trade.sale_fee_value,
        "net_sale_value": trade.net_sale_value,
        "realized_profit": trade.realized_profit,
        "roi_percent": trade.roi_percent,
        "status": trade.status,
        "decision_grade": trade.decision_grade,
        "final_decision": trade.final_decision,
        "decision_score": trade.decision_score,
        "signal": trade.signal,
        "memory_price_state": trade.memory_price_state,
        "notes": trade.notes,
        "created_at": trade.created_at.isoformat() if trade.created_at else None,
        "updated_at": trade.updated_at.isoformat() if trade.updated_at else None,
        "sold_at": trade.sold_at.isoformat() if trade.sold_at else None,
    }


def build_group_performance(trades: list[TradeEntry], field_name: str) -> list[dict]:
    grouped = defaultdict(list)

    for trade in trades:
        key = getattr(trade, field_name) or "Unknown"
        grouped[key].append(trade)

    results = []

    for key, group in grouped.items():
        sold_group = [trade for trade in group if trade.status == "sold"]
        realized_profit = round(sum(trade.realized_profit for trade in sold_group), 2)
        total_cost = round(sum(trade.total_buy_cost for trade in sold_group), 2)
        roi_percent = round((realized_profit / total_cost) * 100, 2) if total_cost > 0 else 0
        wins = len([trade for trade in sold_group if trade.realized_profit > 0])

        results.append(
            {
                "name": key,
                "trade_count": len(group),
                "sold_count": len(sold_group),
                "realized_profit": realized_profit,
                "total_cost": total_cost,
                "roi_percent": roi_percent,
                "win_rate_percent": round((wins / len(sold_group)) * 100, 2) if sold_group else 0,
            }
        )

    results.sort(
        key=lambda item: (
            -item["realized_profit"],
            -item["roi_percent"],
            -item["sold_count"],
        )
    )

    return results


def build_trade_summary(trades: list[TradeEntry]) -> dict:
    open_trades = [trade for trade in trades if trade.status == "open"]
    sold_trades = [trade for trade in trades if trade.status == "sold"]
    failed_trades = [trade for trade in trades if trade.status == "failed"]
    cancelled_trades = [trade for trade in trades if trade.status == "cancelled"]

    total_invested = round(sum(trade.total_buy_cost for trade in trades), 2)
    open_exposure = round(sum(trade.total_buy_cost for trade in open_trades), 2)
    realized_profit = round(sum(trade.realized_profit for trade in sold_trades), 2)
    sold_cost = round(sum(trade.total_buy_cost for trade in sold_trades), 2)
    expected_open_profit = round(sum(trade.expected_profit for trade in open_trades), 2)

    win_count = len([trade for trade in sold_trades if trade.realized_profit > 0])

    return {
        "total_count": len(trades),
        "open_count": len(open_trades),
        "sold_count": len(sold_trades),
        "failed_count": len(failed_trades),
        "cancelled_count": len(cancelled_trades),
        "total_invested": total_invested,
        "open_exposure": open_exposure,
        "realized_profit": realized_profit,
        "expected_open_profit": expected_open_profit,
        "roi_percent": round((realized_profit / sold_cost) * 100, 2) if sold_cost > 0 else 0,
        "win_rate_percent": round((win_count / len(sold_trades)) * 100, 2) if sold_trades else 0,
        "category_performance": build_group_performance(trades, "category"),
        "signal_performance": build_group_performance(trades, "signal"),
        "decision_performance": build_group_performance(trades, "final_decision"),
    }


async def get_trade_by_queue_item(
    db: AsyncSession,
    queue_item_id: int,
) -> TradeEntry | None:
    result = await db.execute(
        select(TradeEntry).where(TradeEntry.buy_queue_item_id == queue_item_id)
    )

    return result.scalars().first()


@router.get("/trades")
async def get_trades(
    connected_realm_id: int | None = Query(default=None),
    status: str = Query(default="open"),
    db: AsyncSession = Depends(get_db),
):
    query = select(TradeEntry)

    if connected_realm_id is not None:
        query = query.where(TradeEntry.realm_id == connected_realm_id)

    if status != "all":
        query = query.where(TradeEntry.status == status)

    result = await db.execute(
        query.order_by(
            TradeEntry.created_at.desc(),
            TradeEntry.decision_score.desc(),
        )
    )

    trades = list(result.scalars().all())

    return {
        "status": "Success",
        "summary": build_trade_summary(trades),
        "items": [serialize_trade(trade) for trade in trades],
    }


@router.post("/trades/from-buy-queue/{queue_item_id}")
async def create_trade_from_buy_queue(
    queue_item_id: int,
    db: AsyncSession = Depends(get_db),
):
    existing_trade = await get_trade_by_queue_item(
        db=db,
        queue_item_id=queue_item_id,
    )

    if existing_trade:
        return {
            "status": "Success",
            "action": "existing",
            "item": serialize_trade(existing_trade),
        }

    queue_result = await db.execute(
        select(BuyQueueItem).where(BuyQueueItem.id == queue_item_id)
    )

    queue_item = queue_result.scalars().first()

    if not queue_item:
        return {
            "status": "Error",
            "error": "Buy queue item not found.",
            "item": None,
        }

    if queue_item.status != "bought":
        return {
            "status": "Error",
            "error": "Only bought queue items can be converted into trades.",
            "item": None,
        }

    quantity = queue_item.bought_quantity or queue_item.suggested_quantity
    buy_price_each = queue_item.bought_price_each or queue_item.max_price_each

    expected_values = calculate_expected_values(
        quantity=quantity,
        buy_price_each=buy_price_each,
        target_sale_price_each=queue_item.target_sale_price_each,
    )

    trade = TradeEntry(
        buy_queue_item_id=queue_item.id,
        item_id=queue_item.item_id,
        realm_id=queue_item.realm_id,
        realm_name=queue_item.realm_name,
        item_name=queue_item.item_name,
        category=queue_item.category,
        icon_url=queue_item.icon_url,
        quality=queue_item.quality,
        quantity_bought=quantity,
        buy_price_each=round(buy_price_each, 2),
        target_sale_price_each=queue_item.target_sale_price_each,
        status="open",
        decision_grade=queue_item.decision_grade,
        final_decision=queue_item.final_decision,
        decision_score=queue_item.decision_score,
        signal=queue_item.signal,
        memory_price_state=queue_item.memory_price_state,
        notes=queue_item.notes,
        **expected_values,
    )

    db.add(trade)
    await db.commit()
    await db.refresh(trade)

    return {
        "status": "Success",
        "action": "created",
        "item": serialize_trade(trade),
    }


@router.post("/trades/manual")
async def create_manual_trade(
    payload: ManualTradePayload,
    db: AsyncSession = Depends(get_db),
):
    expected_values = calculate_expected_values(
        quantity=payload.quantity_bought,
        buy_price_each=payload.buy_price_each,
        target_sale_price_each=payload.target_sale_price_each,
    )

    trade = TradeEntry(
        item_id=payload.item_id,
        realm_id=payload.realm_id,
        realm_name=payload.realm_name,
        item_name=payload.item_name,
        category=payload.category,
        icon_url=payload.icon_url,
        quality=payload.quality,
        quantity_bought=payload.quantity_bought,
        buy_price_each=round(payload.buy_price_each, 2),
        target_sale_price_each=round(payload.target_sale_price_each, 2),
        status="open",
        decision_grade=payload.decision_grade,
        final_decision=payload.final_decision,
        decision_score=payload.decision_score,
        signal=payload.signal,
        memory_price_state=payload.memory_price_state,
        notes=payload.notes,
        **expected_values,
    )

    db.add(trade)
    await db.commit()
    await db.refresh(trade)

    return {
        "status": "Success",
        "item": serialize_trade(trade),
    }


@router.patch("/trades/{trade_id}/mark-sold")
async def mark_trade_sold(
    trade_id: int,
    payload: MarkSoldPayload,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TradeEntry).where(TradeEntry.id == trade_id)
    )

    trade = result.scalars().first()

    if not trade:
        return {
            "status": "Error",
            "error": "Trade not found.",
            "item": None,
        }

    realized_values = calculate_realized_values(
        quantity_sold=payload.quantity_sold,
        actual_sale_price_each=payload.actual_sale_price_each,
        sale_fee_percent=payload.sale_fee_percent,
        total_buy_cost=trade.total_buy_cost,
    )

    trade.status = "sold"
    trade.quantity_sold = payload.quantity_sold
    trade.actual_sale_price_each = round(payload.actual_sale_price_each, 2)
    trade.sale_fee_percent = payload.sale_fee_percent
    trade.sold_at = utc_now()
    trade.updated_at = utc_now()
    trade.notes = payload.notes or trade.notes

    for key, value in realized_values.items():
        setattr(trade, key, value)

    await db.commit()
    await db.refresh(trade)

    return {
        "status": "Success",
        "item": serialize_trade(trade),
    }


@router.patch("/trades/{trade_id}/status")
async def update_trade_status(
    trade_id: int,
    payload: TradeStatusPayload,
    db: AsyncSession = Depends(get_db),
):
    new_status = payload.status.lower().strip()

    if new_status not in ALLOWED_TRADE_STATUSES:
        return {
            "status": "Error",
            "error": f"Status must be one of: {', '.join(sorted(ALLOWED_TRADE_STATUSES))}.",
            "item": None,
        }

    result = await db.execute(
        select(TradeEntry).where(TradeEntry.id == trade_id)
    )

    trade = result.scalars().first()

    if not trade:
        return {
            "status": "Error",
            "error": "Trade not found.",
            "item": None,
        }

    trade.status = new_status
    trade.notes = payload.notes or trade.notes
    trade.updated_at = utc_now()

    await db.commit()
    await db.refresh(trade)

    return {
        "status": "Success",
        "item": serialize_trade(trade),
    }


@router.delete("/trades/{trade_id}")
async def delete_trade(
    trade_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TradeEntry).where(TradeEntry.id == trade_id)
    )

    trade = result.scalars().first()

    if not trade:
        return {
            "status": "Error",
            "error": "Trade not found.",
        }

    await db.delete(trade)
    await db.commit()

    return {
        "status": "Success",
        "deleted_id": trade_id,
    }
