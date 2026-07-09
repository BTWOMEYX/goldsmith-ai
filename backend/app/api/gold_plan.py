from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deals import (
    build_deal_summary,
    load_latest_snapshot_map,
    load_watched_keys,
    serialize_deal_alert,
)
from app.services.ignore_rules import filter_ignored_tracked_items, get_active_ignore_rules
from app.services.market_memory import build_market_memory_map
from app.services.performance_feedback import build_feedback_adjustment_map
from app.services.plan_item_actions import get_plan_action_suppression_summary
from app.services.strategy_profiles import apply_strategy_to_alert, get_active_strategy_profile
from app.utils.realms import get_realm_display_name
from database import get_db
from models import BuyQueueItem, TradeEntry, TrackedItem

router = APIRouter(
    prefix="/api",
    tags=["Gold Plan"],
)


BUY_DECISIONS = {
    "Strong Buy",
    "Buy",
    "Small Buy",
}


ACTIVE_QUEUE_STATUSES = {
    "queued",
    "bought",
}


ACTIVE_TRADE_STATUSES = {
    "open",
}


def get_item_expected_net_profit(item: dict) -> float:
    quantity = int(item.get("suggested_buy_quantity") or 0)
    profit_each = float(item.get("estimated_net_profit_after_ah_cut") or 0)

    return round(quantity * profit_each, 2)


def get_item_plan_spend(item: dict) -> float:
    return round(float(item.get("max_gold_exposure") or 0), 2)


def is_plan_buy_candidate(item: dict) -> bool:
    if item.get("strategy_blocked"):
        return False

    if item.get("already_queued_or_tracked"):
        return False

    if item.get("plan_action_hidden"):
        return False

    if item.get("final_decision") not in BUY_DECISIONS:
        return False

    if int(item.get("suggested_buy_quantity") or 0) <= 0:
        return False

    if float(item.get("suggested_buy_below") or 0) <= 0:
        return False

    if item.get("capital_risk_label") in ["Avoid", "High"]:
        return False

    if float(item.get("estimated_net_profit_after_ah_cut") or 0) <= 0:
        return False

    return True


def enrich_plan_item(item: dict, rank: int) -> dict:
    quantity = int(item.get("suggested_buy_quantity") or 0)
    max_price_each = float(item.get("suggested_buy_below") or 0)
    target_price = float(item.get("target_resale_price") or 0)
    plan_spend = get_item_plan_spend(item)
    expected_net_profit = get_item_expected_net_profit(item)
    expected_net_roi = (
        round((expected_net_profit / plan_spend) * 100, 2)
        if plan_spend > 0
        else 0
    )

    enriched = dict(item)

    enriched["plan_rank"] = rank
    enriched["plan_quantity"] = quantity
    enriched["plan_max_price_each"] = round(max_price_each, 2)
    enriched["plan_target_resale_price"] = round(target_price, 2)
    enriched["plan_max_spend"] = plan_spend
    enriched["plan_expected_net_profit"] = expected_net_profit
    enriched["plan_expected_net_roi"] = expected_net_roi

    return enriched


async def load_excluded_item_ids(
    db: AsyncSession,
    connected_realm_id: int,
) -> set[int]:
    excluded: set[int] = set()

    queue_result = await db.execute(
        select(BuyQueueItem).where(
            BuyQueueItem.realm_id == connected_realm_id,
            BuyQueueItem.status.in_(ACTIVE_QUEUE_STATUSES),
        )
    )

    queue_items = queue_result.scalars().all()

    for item in queue_items:
        excluded.add(item.item_id)

    trade_result = await db.execute(
        select(TradeEntry).where(
            TradeEntry.realm_id == connected_realm_id,
            TradeEntry.status.in_(ACTIVE_TRADE_STATUSES),
        )
    )

    trade_items = trade_result.scalars().all()

    for item in trade_items:
        excluded.add(item.item_id)

    return excluded


def apply_category_diversity(
    items: list[dict],
    limit: int,
    max_per_category: int,
) -> list[dict]:
    selected: list[dict] = []
    category_counts: dict[str, int] = {}

    for item in items:
        category = item.get("goldsmith_category") or "Unknown / Other"
        current_count = category_counts.get(category, 0)

        if max_per_category > 0 and current_count >= max_per_category:
            continue

        selected.append(item)
        category_counts[category] = current_count + 1

        if len(selected) >= limit:
            break

    if len(selected) >= limit:
        return selected

    selected_ids = {item.get("item_id") for item in selected}

    for item in items:
        if item.get("item_id") in selected_ids:
            continue

        selected.append(item)

        if len(selected) >= limit:
            break

    return selected


def calculate_plan_quality(
    buy_count: int,
    recommended_spend: float,
    expected_net_profit: float,
    expected_net_roi: float,
    strategy_profile: dict,
) -> str:
    if buy_count <= 0:
        return "No Plan"

    if expected_net_profit <= 0 or recommended_spend <= 0:
        return "Learning"

    max_exposure = float(strategy_profile.get("max_exposure") or 0)

    if max_exposure > 0 and recommended_spend > max_exposure * 2:
        return "Aggressive"

    if buy_count >= 4 and expected_net_roi >= 18:
        return "Excellent"

    if buy_count >= 2 and expected_net_roi >= 10:
        return "Good"

    if expected_net_roi >= 5:
        return "Cautious"

    return "Thin"


def build_capital_warning(
    buy_count: int,
    recommended_spend: float,
    expected_net_roi: float,
    strategy_profile: dict,
) -> str:
    if buy_count <= 0:
        return "No clean buy plan yet. Queue existing buys, sell tracked trades, run a scan, or try a different strategy."

    max_exposure = float(strategy_profile.get("max_exposure") or 0)

    if max_exposure > 0 and recommended_spend > max_exposure:
        return (
            f"Plan spend is above the {strategy_profile['label']} exposure cap. "
            "Queue fewer items or use a safer profile."
        )

    if expected_net_roi < 5:
        return "Net ROI is thin after AH cut. Only execute if prices are clearly below the cap."

    return "Plan is within strategy limits. Buy manually only if the Auction House price is below the listed cap."


def build_plan_note(
    plan_quality: str,
    buy_count: int,
    strategy_profile: dict,
) -> str:
    if buy_count <= 0:
        return (
            f"{strategy_profile['label']} found no fresh clean buys. "
            "GoldSmith is avoiding duplicate queued/tracked items."
        )

    if plan_quality == "Excellent":
        return (
            f"{strategy_profile['label']} found a strong fresh buy plan. "
            "Prioritise the list from top to bottom."
        )

    if plan_quality == "Good":
        return (
            f"{strategy_profile['label']} found a useful fresh plan. "
            "Execute carefully and stay under the max price."
        )

    if plan_quality == "Cautious":
        return (
            f"{strategy_profile['label']} found some buys, but the plan is moderate. "
            "Keep quantities controlled."
        )

    return (
        f"{strategy_profile['label']} found a thin plan. "
        "Only buy the cleanest opportunities."
    )


def build_category_breakdown(items: list[dict]) -> list[dict]:
    grouped: dict[str, dict] = {}

    for item in items:
        category = item.get("goldsmith_category") or "Unknown / Other"

        if category not in grouped:
            grouped[category] = {
                "category": category,
                "buy_count": 0,
                "recommended_spend": 0,
                "expected_net_profit": 0,
            }

        grouped[category]["buy_count"] += 1
        grouped[category]["recommended_spend"] += get_item_plan_spend(item)
        grouped[category]["expected_net_profit"] += get_item_expected_net_profit(item)

    rows = []

    for row in grouped.values():
        spend = row["recommended_spend"]
        profit = row["expected_net_profit"]

        rows.append(
            {
                "category": row["category"],
                "buy_count": row["buy_count"],
                "recommended_spend": round(spend, 2),
                "expected_net_profit": round(profit, 2),
                "expected_net_roi": round((profit / spend) * 100, 2) if spend > 0 else 0,
            }
        )

    rows.sort(
        key=lambda row: (
            -row["expected_net_profit"],
            -row["expected_net_roi"],
            -row["buy_count"],
        )
    )

    return rows


def build_avoid_notes(items: list[dict]) -> list[dict]:
    avoided = []

    for item in items:
        if item.get("final_decision") != "Avoid" and not item.get("strategy_blocked"):
            continue

        reason = item.get("strategy_note") or item.get("decision_note") or item.get("capital_note")

        avoided.append(
            {
                "item_id": item.get("item_id"),
                "name": item.get("name"),
                "category": item.get("goldsmith_category"),
                "reason": reason,
                "strategy_blocked": item.get("strategy_blocked", False),
                "memory_price_state": item.get("memory_price_state"),
                "capital_risk_label": item.get("capital_risk_label"),
            }
        )

    return avoided[:5]


@router.get("/gold-plan/today")
async def get_today_gold_plan(
    connected_realm_id: int = Query(default=11),
    limit: int = Query(default=5, ge=1, le=15),
    max_per_category: int = Query(default=2, ge=0, le=10),
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

        excluded_item_ids = await load_excluded_item_ids(
            db=db,
            connected_realm_id=connected_realm_id,
        )

        plan_action_summary = await get_plan_action_suppression_summary(
            db=db,
            connected_realm_id=connected_realm_id,
        )

        plan_action_item_ids = set(plan_action_summary["item_ids"])

        watched_keys = await load_watched_keys(db)

        snapshot_map = await load_latest_snapshot_map(
            connected_realm_id=connected_realm_id,
            db=db,
        )

        memory_map = await build_market_memory_map(
            db=db,
            connected_realm_id=connected_realm_id,
            items=tracked_items,
            days=30,
        )

        feedback_map = await build_feedback_adjustment_map(
            db=db,
            connected_realm_id=connected_realm_id,
        )

        strategy_profile = get_active_strategy_profile()

        alert_items = []

        for item in tracked_items:
            alert = apply_strategy_to_alert(
                serialize_deal_alert(
                    item=item,
                    watched_keys=watched_keys,
                    snapshot_map=snapshot_map,
                    market_memory_map=memory_map,
                    performance_feedback_map=feedback_map,
                ),
                strategy_profile,
            )

            alert["already_queued_or_tracked"] = item.item_id in excluded_item_ids
            alert["plan_action_hidden"] = item.item_id in plan_action_item_ids

            alert_items.append(alert)

        alert_items.sort(
            key=lambda item: (
                not is_plan_buy_candidate(item),
                item.get("final_decision") == "Small Buy",
                -float(item.get("decision_score") or 0),
                -float(item.get("estimated_net_margin_percent") or 0),
                -float(item.get("memory_score") or 0),
                -float(item.get("liquidity_score") or 0),
                -float(item.get("opportunity_score") or 0),
            )
        )

        raw_buy_candidates = [
            item
            for item in alert_items
            if is_plan_buy_candidate(item)
        ]

        diversified_buys = apply_category_diversity(
            items=raw_buy_candidates,
            limit=limit,
            max_per_category=max_per_category,
        )

        top_buys = [
            enrich_plan_item(item, index + 1)
            for index, item in enumerate(diversified_buys)
        ]

        recommended_spend = round(
            sum(item["plan_max_spend"] for item in top_buys),
            2,
        )

        expected_net_profit = round(
            sum(item["plan_expected_net_profit"] for item in top_buys),
            2,
        )

        expected_net_roi = (
            round((expected_net_profit / recommended_spend) * 100, 2)
            if recommended_spend > 0
            else 0
        )

        watch_items = [
            item
            for item in alert_items
            if item.get("final_decision") == "Watch"
        ]

        avoid_items = [
            item
            for item in alert_items
            if item.get("final_decision") == "Avoid" or item.get("strategy_blocked")
        ]

        duplicate_count = len(
            [
                item
                for item in alert_items
                if item.get("already_queued_or_tracked")
            ]
        )

        plan_action_hidden_count = len(
            [
                item
                for item in alert_items
                if item.get("plan_action_hidden")
            ]
        )

        plan_action_counts = plan_action_summary["counts"]

        plan_quality = calculate_plan_quality(
            buy_count=len(top_buys),
            recommended_spend=recommended_spend,
            expected_net_profit=expected_net_profit,
            expected_net_roi=expected_net_roi,
            strategy_profile=strategy_profile,
        )

        return {
            "status": "Success",
            "connected_realm_id": connected_realm_id,
            "realm": realm_name,
            "strategy": strategy_profile,
            "plan_quality": plan_quality,
            "recommended_spend": recommended_spend,
            "expected_net_profit": expected_net_profit,
            "expected_net_roi": expected_net_roi,
            "buy_count": len(top_buys),
            "available_buy_count": len(raw_buy_candidates),
            "watch_count": len(watch_items),
            "avoid_count": len(avoid_items),
            "ignored_count": ignored_count,
            "already_queued_or_tracked_count": duplicate_count,
            "plan_action_hidden_count": plan_action_hidden_count,
            "skipped_today_count": plan_action_counts.get("skipped_today", 0),
            "snoozed_count": plan_action_counts.get("snoozed", 0),
            "plan_ignored_count": plan_action_counts.get("ignored", 0),
            "max_per_category": max_per_category,
            "capital_warning": build_capital_warning(
                buy_count=len(top_buys),
                recommended_spend=recommended_spend,
                expected_net_roi=expected_net_roi,
                strategy_profile=strategy_profile,
            ),
            "plan_note": build_plan_note(
                plan_quality=plan_quality,
                buy_count=len(top_buys),
                strategy_profile=strategy_profile,
            ),
            "top_buys": top_buys,
            "category_breakdown": build_category_breakdown(top_buys),
            "avoid_notes": build_avoid_notes(alert_items),
            "deals_summary": build_deal_summary(alert_items),
        }

    except Exception as error:
        return {
            "status": "Error",
            "connected_realm_id": connected_realm_id,
            "error": str(error),
            "strategy": get_active_strategy_profile(),
            "plan_quality": "Error",
            "recommended_spend": 0,
            "expected_net_profit": 0,
            "expected_net_roi": 0,
            "buy_count": 0,
            "available_buy_count": 0,
            "watch_count": 0,
            "avoid_count": 0,
            "ignored_count": 0,
            "already_queued_or_tracked_count": 0,
            "plan_action_hidden_count": 0,
            "skipped_today_count": 0,
            "snoozed_count": 0,
            "plan_ignored_count": 0,
            "max_per_category": 2,
            "capital_warning": "Unable to build today's gold plan.",
            "plan_note": "GoldSmith could not build a plan because the backend returned an error.",
            "top_buys": [],
            "category_breakdown": [],
            "avoid_notes": [],
            "deals_summary": build_deal_summary([]),
        }
