from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\backend\app\api\action_center.py")
text = path.read_text()

if "from app.services.strategy_profiles import" not in text:
    text = text.replace(
        "from app.services.performance_feedback import build_feedback_adjustment_map",
        "from app.services.performance_feedback import build_feedback_adjustment_map\nfrom app.services.strategy_profiles import apply_strategy_to_alert, get_active_strategy_profile",
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
        """            "realm": realm_name,
            "top_action": top_action,
""",
        """            "realm": realm_name,
            "strategy": strategy_profile,
            "top_action": top_action,
""",
        1,
    )

path.write_text(text)

print("action_center.py patched with Strategy Profiles.")
