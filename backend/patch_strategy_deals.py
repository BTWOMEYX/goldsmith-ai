from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\backend\app\api\deals.py")
text = path.read_text()

if "from app.services.strategy_profiles import" not in text:
    text = text.replace(
        "from app.services.performance_feedback import build_feedback_adjustment_map, combine_performance_feedback_adjustments",
        "from app.services.performance_feedback import build_feedback_adjustment_map, combine_performance_feedback_adjustments\nfrom app.services.strategy_profiles import apply_strategy_to_alert, get_active_strategy_profile",
    )

if "strategy_profile = get_active_strategy_profile()" not in text:
    text = text.replace(
        """        feedback_map = await build_feedback_adjustment_map(
            db=db,
            connected_realm_id=connected_realm_id,
        )
""",
        """        feedback_map = await build_feedback_adjustment_map(
            db=db,
            connected_realm_id=connected_realm_id,
        )

        strategy_profile = get_active_strategy_profile()
""",
        1,
    )

    text = text.replace(
        """        feedback_map = await build_feedback_adjustment_map(
            db=db,
            connected_realm_id=connected_realm_id,
        )
""",
        """        feedback_map = await build_feedback_adjustment_map(
            db=db,
            connected_realm_id=connected_realm_id,
        )

        strategy_profile = get_active_strategy_profile()
""",
        1,
    )

if "apply_strategy_to_alert(" not in text:
    text = text.replace(
        """        alert_items = [
            serialize_deal_alert(
                item=item,
                watched_keys=watched_keys,
                snapshot_map=snapshot_map,
                market_memory_map=memory_map,
                performance_feedback_map=feedback_map,
            )
            for item in tracked_items
        ]
""",
        """        alert_items = [
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
""",
    )

if '"strategy": strategy_profile,' not in text:
    text = text.replace(
        """            "ignored_count": ignored_count,
            "top_alert": alert_items[0] if alert_items else None,
""",
        """            "ignored_count": ignored_count,
            "strategy": strategy_profile,
            "top_alert": alert_items[0] if alert_items else None,
""",
        1,
    )

    text = text.replace(
        """            "ignored_count": ignored_count,
            "items": added_items,
""",
        """            "ignored_count": ignored_count,
            "strategy": strategy_profile,
            "items": added_items,
""",
        1,
    )

if 'alert.get("strategy_blocked")' not in text:
    text = text.replace(
        """    if alert["is_watched"]:
        return False
""",
        """    if alert["is_watched"]:
        return False

    if alert.get("strategy_blocked"):
        return False
""",
    )

path.write_text(text)

print("deals.py patched with Strategy Profiles.")
