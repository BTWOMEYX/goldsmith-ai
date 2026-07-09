from pathlib import Path

main_path = Path(r"F:\Projects\goldsmith-ai\backend\app\main.py")
text = main_path.read_text()

if "from app.api.autopilot import router as autopilot_router" not in text:
    text = text.replace(
        "from app.api.action_center import router as action_center_router",
        "from app.api.action_center import router as action_center_router\nfrom app.api.autopilot import router as autopilot_router",
    )

if "app.include_router(autopilot_router)" not in text:
    text = text.replace(
        "app.include_router(action_center_router)",
        "app.include_router(action_center_router)\napp.include_router(autopilot_router)",
    )

main_path.write_text(text)

print("autopilot router added to main.py")
