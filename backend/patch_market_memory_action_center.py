from pathlib import Path

action_path = Path(r"F:\Projects\goldsmith-ai\backend\app\api\action_center.py")
text = action_path.read_text()

if "from app.services.market_memory import" not in text:
    text = text.replace(
        "from app.services.ignore_rules import filter_ignored_tracked_items, get_active_ignore_rules",
        "from app.services.ignore_rules import filter_ignored_tracked_items, get_active_ignore_rules\nfrom app.services.market_memory import build_market_memory_map",
    )

snapshot_block = '''        snapshot_map = await load_latest_snapshot_map(
            connected_realm_id=connected_realm_id,
            db=db,
        )

'''

memory_block = '''        snapshot_map = await load_latest_snapshot_map(
            connected_realm_id=connected_realm_id,
            db=db,
        )

        memory_map = await build_market_memory_map(
            db=db,
            connected_realm_id=connected_realm_id,
            items=tracked_items,
            days=30,
        )

'''

if "memory_map = await build_market_memory_map" not in text:
    text = text.replace(snapshot_block, memory_block, 1)

old_call = '''                snapshot_map=snapshot_map,
            )
'''

new_call = '''                snapshot_map=snapshot_map,
                market_memory_map=memory_map,
            )
'''

if "market_memory_map=memory_map" not in text:
    text = text.replace(old_call, new_call, 1)

if '"memory_undervalued_count":' not in text:
    text = text.replace(
        '''                "suppressed_count": ignored_count,
                "capture": capture_summary,
''',
        '''                "suppressed_count": ignored_count,
                "memory_undervalued_count": len([
                    alert for alert in alert_items
                    if alert.get("memory_price_state") in ["Deep Undervalued", "Undervalued", "Below Normal"]
                ]),
                "memory_volatile_count": len([
                    alert for alert in alert_items
                    if alert.get("memory_price_state") == "Volatile"
                ]),
                "capture": capture_summary,
''',
        1,
    )

action_path.write_text(text)

print("action_center.py patched with Market Memory.")
