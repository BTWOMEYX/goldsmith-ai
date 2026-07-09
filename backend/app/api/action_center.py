from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deals import (
    build_deal_summary,
    load_latest_snapshot_map,
    load_watched_keys,
    serialize_deal_alert,
    should_auto_watch,
)
from app.services.ignore_rules import filter_ignored_tracked_items, get_active_ignore_rules
from app.services.market_memory import build_market_memory_map
from app.services.performance_feedback import build_feedback_adjustment_map
from app.services.strategy_profiles import apply_strategy_to_alert, get_active_strategy_profile
from app.utils.realms import get_realm_display_name
from database import get_db
from models import MarketSnapshot, TrackedItem, WatchlistItem

router = APIRouter(
    prefix="/api",
    tags=["Action Center"],
)


def serialize_watchlist_action(item: WatchlistItem) -> dict:
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
        "item_class": item.item_class,
        "item_subclass": item.item_subclass,
        "goldsmith_category": item.goldsmith_category,
        "profit_margin": item.profit_margin,
        "saved_at": item.created_at.isoformat() if item.created_at else None,
    }


def build_category_focus(alert_items: list[dict]) -> list[dict]:
    category_map: dict[str, dict] = {}

    for alert in alert_items:
        category = alert.get("goldsmith_category") or "Unknown / Other"

        if category not in category_map:
            category_map[category] = {
                "category": category,
                "alert_count": 0,
                "actionable_count": 0,
                "average_confidence": 0,
                "total_confidence": 0,
                "best_signal": alert.get("signal_label", "Hold"),
                "best_priority": alert.get("signal_priority", 99),
            }

        category_map[category]["alert_count"] += 1
        category_map[category]["total_confidence"] += alert.get(
            "signal_confidence",
            0,
        )

        if alert.get("signal") in [
            "AUTO_WATCH",
            "FAST_MOVER",
            "PRICE_DROP",
            "HIGH_MARGIN",
        ]:
            category_map[category]["actionable_count"] += 1

        if alert.get("signal_priority", 99) < category_map[category]["best_priority"]:
            category_map[category]["best_signal"] = alert.get(
                "signal_label",
                "Hold",
            )
            category_map[category]["best_priority"] = alert.get(
                "signal_priority",
                99,
            )

    category_focus = []

    for category_data in category_map.values():
        alert_count = category_data["alert_count"]

        category_data["average_confidence"] = round(
            category_data["total_confidence"] / alert_count,
            1,
        )

        del category_data["total_confidence"]
        del category_data["best_priority"]

        category_focus.append(category_data)

    category_focus.sort(
        key=lambda item: (
            item["actionable_count"],
            item["average_confidence"],
            item["alert_count"],
        ),
        reverse=True,
    )

    return category_focus[:5]


def build_top_action(
    tracked_count: int,
    auto_watch_ready_count: int,
    top_alert: dict | None,
    watchlist_count: int,
    latest_capture_at: str | None,
) -> dict:
    if tracked_count == 0:
        return {
            "type": "RUN_FULL_SCAN",
            "title": "Run a Full Scan",
            "priority": "High",
            "summary": "No opportunities are loaded for this realm yet.",
            "action": "Use the Global Sync bar above and run a Full Scan.",
            "target_page": "/",
            "button_label": "Use Global Sync Above",
        }

    if auto_watch_ready_count > 0:
        return {
            "type": "REVIEW_AUTO_WATCH",
            "title": "Review Auto-Watch Deals",
            "priority": "High",
            "summary": (
                f"{auto_watch_ready_count} high-confidence deal "
                f"candidate{'' if auto_watch_ready_count == 1 else 's'} ready."
            ),
            "action": "Open Deal Alerts and review the best buys before committing gold.",
            "target_page": "/alerts",
            "button_label": "Open Deal Alerts",
        }

    if top_alert and top_alert.get("signal") in [
        "FAST_MOVER",
        "PRICE_DROP",
        "HIGH_MARGIN",
        "WATCH_CANDIDATE",
    ]:
        return {
            "type": "REVIEW_TOP_ALERT",
            "title": top_alert.get("signal_label", "Review Alert"),
            "priority": "Medium",
            "summary": top_alert.get("name", "A deal alert needs review."),
            "action": top_alert.get(
                "signal_action",
                "Review the alert queue.",
            ),
            "target_page": "/alerts",
            "button_label": "Review Alert",
        }

    if watchlist_count > 0:
        return {
            "type": "CHECK_WATCHLIST",
            "title": "Check Watchlist",
            "priority": "Medium",
            "summary": (
                f"{watchlist_count} watched "
                f"target{'' if watchlist_count == 1 else 's'} saved."
            ),
            "action": "Review saved targets and decide what to buy, hold, or remove.",
            "target_page": "/watchlist",
            "button_label": "Open Watchlist",
        }

    if latest_capture_at:
        return {
            "type": "EXPLORE_MARKET",
            "title": "Explore Market Categories",
            "priority": "Low",
            "summary": "Market data exists, but no urgent buy action is currently showing.",
            "action": "Use the Market Scanner to inspect categories and adjust filters.",
            "target_page": "/markets",
            "button_label": "Open Scanner",
        }

    return {
        "type": "RUN_QUICK_SCAN",
        "title": "Run a Quick Scan",
        "priority": "Medium",
        "summary": "GoldSmith needs fresh auction data.",
        "action": "Use the Global Sync bar above and run a Quick Scan.",
        "target_page": "/",
        "button_label": "Use Global Sync Above",
    }


@router.get("/action-center")
async def get_action_center(
    connected_realm_id: int = Query(default=11),
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

        watchlist_count_result = await db.execute(
            select(func.count(WatchlistItem.id)).where(
                WatchlistItem.realm_id == connected_realm_id
            )
        )

        watchlist_count = int(watchlist_count_result.scalar() or 0)

        watchlist_result = await db.execute(
            select(WatchlistItem)
            .where(WatchlistItem.realm_id == connected_realm_id)
            .order_by(
                WatchlistItem.opportunity_score.desc(),
                WatchlistItem.created_at.desc(),
            )
            .limit(5)
        )

        watchlist_items = watchlist_result.scalars().all()

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

        alert_items = [
            apply_strategy_to_alert(
                serialize_deal_alert(
                    item=item,
                    watched_keys=watched_keys,
                    snapshot_map=snapshot_map,
                    market_memory_map=memory_map,
                    performance_feedback_map=feedback_map,
                ),
                strategy_profile,
            )
            for item in tracked_items
        ]

        alert_items.sort(
            key=lambda item: (
                item["signal_priority"],
                -item["signal_confidence"],
                -item["opportunity_score"],
                -item["volume"],
            )
        )

        top_alert = alert_items[0] if alert_items else None

        auto_watch_ready = [
            alert
            for alert in alert_items
            if should_auto_watch(alert)
        ]

        latest_capture_result = await db.execute(
            select(func.max(MarketSnapshot.created_at)).where(
                MarketSnapshot.realm_id == connected_realm_id
            )
        )

        latest_capture_at = latest_capture_result.scalar()

        capture_summary = {
            "latest_capture_at": latest_capture_at.isoformat()
            if latest_capture_at
            else None,
            "item_count": 0,
            "total_volume": 0,
            "total_market_value": 0,
        }

        if latest_capture_at:
            capture_total_result = await db.execute(
                select(
                    func.count(MarketSnapshot.id),
                    func.coalesce(func.sum(MarketSnapshot.volume), 0),
                    func.coalesce(func.sum(MarketSnapshot.total_market_value), 0),
                ).where(
                    MarketSnapshot.realm_id == connected_realm_id,
                    MarketSnapshot.created_at == latest_capture_at,
                )
            )

            capture_total = capture_total_result.one()

            capture_summary = {
                "latest_capture_at": latest_capture_at.isoformat(),
                "item_count": int(capture_total[0] or 0),
                "total_volume": int(capture_total[1] or 0),
                "total_market_value": float(capture_total[2] or 0),
            }

        deal_summary = build_deal_summary(alert_items)

        category_focus = build_category_focus(alert_items)

        top_action = build_top_action(
            tracked_count=len(tracked_items),
            auto_watch_ready_count=len(auto_watch_ready),
            top_alert=top_alert,
            watchlist_count=watchlist_count,
            latest_capture_at=capture_summary["latest_capture_at"],
        )

        actionable_count = (
            deal_summary["auto_watch_count"]
            + deal_summary["fast_mover_count"]
            + deal_summary["price_drop_count"]
            + deal_summary["high_margin_count"]
        )

        return {
            "status": "Success",
            "connected_realm_id": connected_realm_id,
            "realm": realm_name,
            "strategy": strategy_profile,
            "top_action": top_action,
            "top_alert": top_alert,
            "actions": alert_items[:5],
            "watchlist_priority": [
                serialize_watchlist_action(item)
                for item in watchlist_items
            ],
            "category_focus": category_focus,
            "summary": {
                "tracked_count": len(tracked_items),
                "alert_count": len(alert_items),
                "actionable_count": actionable_count,
                "auto_watch_ready_count": len(auto_watch_ready),
                "watchlist_count": watchlist_count,
                "suppressed_count": ignored_count,
                "memory_undervalued_count": len([
                    alert for alert in alert_items
                    if alert.get("memory_price_state") in ["Deep Undervalued", "Undervalued", "Below Normal"]
                ]),
                "memory_volatile_count": len([
                    alert for alert in alert_items
                    if alert.get("memory_price_state") == "Volatile"
                ]),
                "capture": capture_summary,
                "deals": deal_summary,
            },
        }

    except Exception as error:
        return {
            "status": "Error",
            "connected_realm_id": connected_realm_id,
            "realm": f"Connected Realm {connected_realm_id}",
            "error": str(error),
            "top_action": {
                "type": "ERROR",
                "title": "Action Center Error",
                "priority": "High",
                "summary": "Unable to load action center.",
                "action": str(error),
                "target_page": "/",
                "button_label": "Check Backend",
            },
            "top_alert": None,
            "actions": [],
            "watchlist_priority": [],
            "category_focus": [],
            "summary": {
                "tracked_count": 0,
                "alert_count": 0,
                "actionable_count": 0,
                "auto_watch_ready_count": 0,
                "watchlist_count": 0,
                "capture": {
                    "latest_capture_at": None,
                    "item_count": 0,
                    "total_volume": 0,
                    "total_market_value": 0,
                },
                "deals": build_deal_summary([]),
            },
        }