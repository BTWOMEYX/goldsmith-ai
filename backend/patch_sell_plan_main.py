from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\backend\app\main.py")
text = path.read_text()

if "from app.api.sell_plan import router as sell_plan_router" not in text:
    text = text.replace(
        "from app.api.realms import router as realms_router",
        "from app.api.realms import router as realms_router\nfrom app.api.sell_plan import router as sell_plan_router",
    )

if "app.include_router(sell_plan_router)" not in text:
    text = text.replace(
        "app.include_router(realms_router)",
        "app.include_router(realms_router)\napp.include_router(sell_plan_router)",
    )

path.write_text(text, encoding="utf-8")

print("sell_plan router added to main.py")
