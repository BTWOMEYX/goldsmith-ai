from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\backend\app\main.py")
text = path.read_text()

if "from app.api.strategy import router as strategy_router" not in text:
    text = text.replace(
        "from app.api.sync import router as sync_router",
        "from app.api.sync import router as sync_router\nfrom app.api.strategy import router as strategy_router",
    )

if "app.include_router(strategy_router)" not in text:
    text = text.replace(
        "app.include_router(sync_router)",
        "app.include_router(sync_router)\napp.include_router(strategy_router)",
    )

path.write_text(text)

print("strategy router added to main.py")
