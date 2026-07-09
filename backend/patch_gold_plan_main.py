from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\backend\app\main.py")
text = path.read_text()

if "from app.api.gold_plan import router as gold_plan_router" not in text:
    text = text.replace(
        "from app.api.health import router as health_router",
        "from app.api.health import router as health_router\nfrom app.api.gold_plan import router as gold_plan_router",
    )

if "app.include_router(gold_plan_router)" not in text:
    text = text.replace(
        "app.include_router(health_router)",
        "app.include_router(health_router)\napp.include_router(gold_plan_router)",
    )

path.write_text(text)

print("gold_plan router added to main.py")
