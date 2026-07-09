from pathlib import Path

main_path = Path(r"F:\Projects\goldsmith-ai\backend\app\main.py")
text = main_path.read_text()

if "from app.api.buy_queue import router as buy_queue_router" not in text:
    text = text.replace(
        "from app.api.autopilot import router as autopilot_router",
        "from app.api.autopilot import router as autopilot_router\nfrom app.api.buy_queue import router as buy_queue_router",
    )

if "app.include_router(buy_queue_router)" not in text:
    text = text.replace(
        "app.include_router(autopilot_router)",
        "app.include_router(autopilot_router)\napp.include_router(buy_queue_router)",
    )

main_path.write_text(text)

print("buy_queue router added to main.py")
