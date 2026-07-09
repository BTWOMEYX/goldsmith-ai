AH_CUT_PERCENT = 5.0
AH_CUT_RATE = AH_CUT_PERCENT / 100


from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.utils.realms import get_realm_display_name
from database import get_db
from models import TradeEntry, TrackedItem

router = APIRouter(
    prefix="/api",
    tags=["Sell Plan"],
)


def round_gold(value: float) -> float:
    return round(float(value or 0), 2)


def calculate_break_even_price_each(buy_price_each: float) -> float:
    if AH_CUT_RATE >= 1:
        return round_gold(buy_price_each)

    return round_gold(buy_price_each / (1 - AH_CUT_RATE))


def calculate_net_value(price_each: float, quantity: int) -> float:
    gross_value = price_each * quantity
    return round_gold(gross_value * (1 - AH_CUT_RATE))


def calculate_profit(price_each: float, quantity: int, total_buy_cost: float) -> dict:
    gross_sale_value = round_gold(price_each * quantity)
    ah_cut_value = round_gold(gross_sale_value * AH_CUT_RATE)
    net_sale_value = round_gold(gross_sale_value - ah_cut_value)
    net_profit = round_gold(net_sale_value - total_buy_cost)

    roi_percent = (
        round((net_profit / total_buy_cost) * 100, 2)
        if total_buy_cost > 0
        else 0
    )

    return {
        "gross_sale_value": gross_sale_value,
        "ah_cut_value": ah_cut_value,
        "net_sale_value": net_sale_value,
        "net_profit": net_profit,
        "roi_percent": roi_percent,
    }


def determine_sell_action(
    current_market_price: float,
    target_sale_price_each: float,
    break_even_price_each: float,
    current_roi_percent: float,
    target_roi_percent: float,
) -> dict:
    if current_market_price <= 0:
        return {
            "sell_action": "No Market Data",
            "priority": 5,
            "risk_level": "Unknown",
            "note": "No current market price is available yet. Run a scan before listing.",
        }

    if current_market_price >= target_sale_price_each:
        return {
            "sell_action": "Take Profit",
            "priority": 1,
            "risk_level": "Low",
            "note": "Current market is at or above target. List now and take profit.",
        }

    if current_roi_percent >= 12:
        return {
            "sell_action": "List Now",
            "priority": 2,
            "risk_level": "Low",
            "note": "Current market is profitable after AH cut. Listing now is reasonable.",
        }

    if current_roi_percent >= 3:
        return {
            "sell_action": "Reprice Lower",
            "priority": 3,
            "risk_level": "Medium",
            "note": "Current market is profitable but below target. List only if you want faster turnover.",
        }

    if current_market_price >= break_even_price_each:
        return {
            "sell_action": "Break Even",
            "priority": 4,
            "risk_level": "Medium",
            "note": "Current market is around break-even after AH cut. Hold unless you need capital back.",
        }

    if current_roi_percent <= -15:
        return {
            "sell_action": "Cut Loss",
            "priority": 6,
            "risk_level": "High",
            "note": "Current market is well below break-even. Consider cutting loss only if capital is needed.",
        }

    return {
        "sell_action": "Hold",
        "priority": 5,
        "risk_level": "Medium",
        "note": "Current market is below a clean profit level. Hold and wait for a better price.",
    }


def determine_recommended_list_price(
    current_market_price: float,
    target_sale_price_each: float,
    break_even_price_each: float,
    sell_action: str,
) -> float:
    if current_market_price <= 0:
        return round_gold(target_sale_price_each)

    if sell_action == "Take Profit":
        return round_gold(max(target_sale_price_each, current_market_price * 0.995))

    if sell_action == "List Now":
        return round_gold(min(target_sale_price_each, current_market_price * 0.995))

    if sell_action == "Reprice Lower":
        return round_gold(max(break_even_price_each * 1.03, current_market_price * 0.995))

    if sell_action == "Break Even":
        return round_gold(max(break_even_price_each, current_market_price * 0.995))

    if sell_action == "Cut Loss":
        return round_gold(current_market_price * 0.995)

    return round_gold(target_sale_price_each)


def serialize_sell_plan_item(
    trade: TradeEntry,
    tracked_item: TrackedItem | None,
) -> dict:
    current_market_price = round_gold(
        tracked_item.current_price if tracked_item else 0
    )

    quantity = int(trade.quantity_bought or 0)
    total_buy_cost = round_gold(trade.total_buy_cost)
    buy_price_each = round_gold(trade.buy_price_each)
    target_sale_price_each = round_gold(trade.target_sale_price_each)

    break_even_price_each = calculate_break_even_price_each(buy_price_each)

    current_profit = calculate_profit(
        price_each=current_market_price,
        quantity=quantity,
        total_buy_cost=total_buy_cost,
    )

    target_profit = calculate_profit(
        price_each=target_sale_price_each,
        quantity=quantity,
        total_buy_cost=total_buy_cost,
    )

    action = determine_sell_action(
        current_market_price=current_market_price,
        target_sale_price_each=target_sale_price_each,
        break_even_price_each=break_even_price_each,
        current_roi_percent=current_profit["roi_percent"],
        target_roi_percent=target_profit["roi_percent"],
    )

    recommended_list_price = determine_recommended_list_price(
        current_market_price=current_market_price,
        target_sale_price_each=target_sale_price_each,
        break_even_price_each=break_even_price_each,
        sell_action=action["sell_action"],
    )

    recommended_profit = calculate_profit(
        price_each=recommended_list_price,
        quantity=quantity,
        total_buy_cost=total_buy_cost,
    )

    target_hit = current_market_price >= target_sale_price_each if current_market_price > 0 else False
    above_break_even = current_market_price >= break_even_price_each if current_market_price > 0 else False

    return {
        "trade_id": trade.id,
        "buy_queue_item_id": trade.buy_queue_item_id,
        "item_id": trade.item_id,
        "realm_id": trade.realm_id,
        "realm_name": trade.realm_name,
        "item_name": trade.item_name,
        "category": trade.category,
        "icon_url": trade.icon_url,
        "quality": trade.quality,

        "quantity_bought": quantity,
        "buy_price_each": buy_price_each,
        "total_buy_cost": total_buy_cost,

        "current_market_price": current_market_price,
        "target_sale_price_each": target_sale_price_each,
        "break_even_price_each": break_even_price_each,
        "recommended_list_price": recommended_list_price,

        "current_gross_sale_value": current_profit["gross_sale_value"],
        "current_net_sale_value": current_profit["net_sale_value"],
        "current_net_profit": current_profit["net_profit"],
        "current_roi_percent": current_profit["roi_percent"],

        "target_net_profit": target_profit["net_profit"],
        "target_roi_percent": target_profit["roi_percent"],

        "recommended_net_profit": recommended_profit["net_profit"],
        "recommended_roi_percent": recommended_profit["roi_percent"],

        "ah_cut_percent": AH_CUT_PERCENT,
        "sell_action": action["sell_action"],
        "sell_priority": action["priority"],
        "sell_risk_level": action["risk_level"],
        "sell_note": action["note"],
        "target_hit": target_hit,
        "above_break_even": above_break_even,

        "decision_grade": trade.decision_grade,
        "final_decision": trade.final_decision,
        "decision_score": trade.decision_score,
        "signal": trade.signal,
        "memory_price_state": trade.memory_price_state,
        "notes": trade.notes,
        "created_at": trade.created_at.isoformat() if trade.created_at else None,
    }


def build_summary(items: list[dict]) -> dict:
    list_now_items = [
        item
        for item in items
        if item["sell_action"] in ["Take Profit", "List Now", "Reprice Lower"]
    ]

    hold_items = [
        item
        for item in items
        if item["sell_action"] in ["Hold", "Break Even", "No Market Data"]
    ]

    cut_loss_items = [
        item
        for item in items
        if item["sell_action"] == "Cut Loss"
    ]

    total_cost = round_gold(sum(item["total_buy_cost"] for item in items))
    current_net_profit = round_gold(sum(item["current_net_profit"] for item in items))
    recommended_net_profit = round_gold(sum(item["recommended_net_profit"] for item in list_now_items))

    current_roi_percent = (
        round((current_net_profit / total_cost) * 100, 2)
        if total_cost > 0
        else 0
    )

    return {
        "open_trade_count": len(items),
        "list_now_count": len(list_now_items),
        "hold_count": len(hold_items),
        "cut_loss_count": len(cut_loss_items),
        "total_open_cost": total_cost,
        "current_net_profit": current_net_profit,
        "current_roi_percent": current_roi_percent,
        "recommended_net_profit": recommended_net_profit,
    }


@router.get("/sell-plan/open")
async def get_open_sell_plan(
    connected_realm_id: int = Query(default=11),
    db: AsyncSession = Depends(get_db),
):
    try:
        realm_name = await get_realm_display_name(connected_realm_id)

        trade_result = await db.execute(
            select(TradeEntry)
            .where(TradeEntry.realm_id == connected_realm_id)
            .where(TradeEntry.status == "open")
            .order_by(
                TradeEntry.created_at.asc(),
                TradeEntry.decision_score.desc(),
            )
        )

        open_trades = list(trade_result.scalars().all())

        item_ids = [
            trade.item_id
            for trade in open_trades
        ]

        tracked_map: dict[int, TrackedItem] = {}

        if item_ids:
            tracked_result = await db.execute(
                select(TrackedItem).where(
                    TrackedItem.realm_id == connected_realm_id,
                    TrackedItem.item_id.in_(item_ids),
                )
            )

            tracked_items = list(tracked_result.scalars().all())

            tracked_map = {
                item.item_id: item
                for item in tracked_items
            }

        items = [
            serialize_sell_plan_item(
                trade=trade,
                tracked_item=tracked_map.get(trade.item_id),
            )
            for trade in open_trades
        ]

        items.sort(
            key=lambda item: (
                item["sell_priority"],
                -item["recommended_net_profit"],
                -item["current_roi_percent"],
                item["item_name"],
            )
        )

        return {
            "status": "Success",
            "connected_realm_id": connected_realm_id,
            "realm": realm_name,
            "summary": build_summary(items),
            "items": items,
        }

    except Exception as error:
        return {
            "status": "Error",
            "connected_realm_id": connected_realm_id,
            "error": str(error),
            "summary": build_summary([]),
            "items": [],
        }
