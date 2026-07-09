from pathlib import Path

main_path = Path(r"F:\Projects\goldsmith-ai\backend\app\main.py")
text = main_path.read_text()

if "from app.api.market_memory import router as market_memory_router" not in text:
    text = text.replace(
        "from app.api.ignore_rules import router as ignore_rules_router",
        "from app.api.ignore_rules import router as ignore_rules_router\nfrom app.api.market_memory import router as market_memory_router",
    )

if "app.include_router(market_memory_router)" not in text:
    text = text.replace(
        "app.include_router(ignore_rules_router)",
        "app.include_router(ignore_rules_router)\napp.include_router(market_memory_router)",
    )

main_path.write_text(text)

print("market_memory router added to main.py")
