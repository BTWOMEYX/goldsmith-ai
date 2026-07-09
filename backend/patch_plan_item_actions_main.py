from pathlib import Path

path = Path(r"F:\Projects\goldsmith-ai\backend\app\main.py")
text = path.read_text()

if "from app.api.plan_item_actions import router as plan_item_actions_router" not in text:
    text = text.replace(
        "from app.api.performance_feedback import router as performance_feedback_router",
        "from app.api.performance_feedback import router as performance_feedback_router\nfrom app.api.plan_item_actions import router as plan_item_actions_router",
    )

if "app.include_router(plan_item_actions_router)" not in text:
    text = text.replace(
        "app.include_router(performance_feedback_router)",
        "app.include_router(performance_feedback_router)\napp.include_router(plan_item_actions_router)",
    )

path.write_text(text)

print("plan_item_actions router added to main.py")
