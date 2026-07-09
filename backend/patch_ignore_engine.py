from pathlib import Path

backend = Path(r"F:\Projects\goldsmith-ai\backend")

main_path = backend / "app" / "main.py"
deals_path = backend / "app" / "api" / "deals.py"
action_path = backend / "app" / "api" / "action_center.py"

main_text = main_path.read_text()

if "from app.api.ignore_rules import router as ignore_rules_router" not in main_text:
    main_text = main_text.replace(
        "from app.api.health import router as health_router",
        "from app.api.health import router as health_router\nfrom app.api.ignore_rules import router as ignore_rules_router",
    )

if "app.include_router(ignore_rules_router)" not in main_text:
    main_text = main_text.replace(
        "app.include_router(history_router)",
        "app.include_router(history_router)\napp.include_router(ignore_rules_router)",
    )

main_path.write_text(main_text)


deals_text = deals_path.read_text()

if "from app.services.ignore_rules import" not in deals_text:
    deals_text = deals_text.replace(
        "from app.utils.realms import get_realm_display_name",
        "from app.services.ignore_rules import filter_ignored_tracked_items, get_active_ignore_rules\nfrom app.utils.realms import get_realm_display_name",
    )

old_block = """        tracked_items = tracked_result.scalars().all()

        watched_keys = await load_watched_keys(db)
"""

new_block = """        tracked_items = tracked_result.scalars().all()

        ignore_rules = await get_active_ignore_rules(
            db=db,
            connected_realm_id=connected_realm_id,
        )

        tracked_items, ignored_count = filter_ignored_tracked_items(
            tracked_items,
            ignore_rules,
        )

        watched_keys = await load_watched_keys(db)
"""

if old_block in deals_text:
    deals_text = deals_text.replace(old_block, new_block, 1)

old_block_auto = """        tracked_items = tracked_result.scalars().all()

        watched_keys = await load_watched_keys(db)
"""

if old_block_auto in deals_text:
    deals_text = deals_text.replace(old_block_auto, new_block, 1)

if '"ignored_count": ignored_count,' not in deals_text:
    deals_text = deals_text.replace(
        '"alert_count": len(alert_items),',
        '"alert_count": len(alert_items),\n            "ignored_count": ignored_count,',
        1,
    )

    deals_text = deals_text.replace(
        '"auto_watch_added": len(added_items),',
        '"auto_watch_added": len(added_items),\n            "ignored_count": ignored_count,',
        1,
    )

deals_path.write_text(deals_text)


action_text = action_path.read_text()

if "from app.services.ignore_rules import" not in action_text:
    action_text = action_text.replace(
        "from app.utils.realms import get_realm_display_name",
        "from app.services.ignore_rules import filter_ignored_tracked_items, get_active_ignore_rules\nfrom app.utils.realms import get_realm_display_name",
    )

old_action_block = """        tracked_items = tracked_result.scalars().all()

        watchlist_count_result = await db.execute(
"""

new_action_block = """        tracked_items = tracked_result.scalars().all()

        ignore_rules = await get_active_ignore_rules(
            db=db,
            connected_realm_id=connected_realm_id,
        )

        tracked_items, ignored_count = filter_ignored_tracked_items(
            tracked_items,
            ignore_rules,
        )

        watchlist_count_result = await db.execute(
"""

if old_action_block in action_text:
    action_text = action_text.replace(old_action_block, new_action_block, 1)

if '"suppressed_count": ignored_count,' not in action_text:
    action_text = action_text.replace(
        '"watchlist_count": watchlist_count,',
        '"watchlist_count": watchlist_count,\n                "suppressed_count": ignored_count,',
        1,
    )

action_path.write_text(action_text)

print("Smart Ignore Engine patched successfully.")
