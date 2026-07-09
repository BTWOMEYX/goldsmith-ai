from pathlib import Path

main_path = Path(r"F:\Projects\goldsmith-ai\backend\app\main.py")
text = main_path.read_text()

if "from app.api.performance_feedback import router as performance_feedback_router" not in text:
    text = text.replace(
        "from app.api.market_memory import router as market_memory_router",
        "from app.api.market_memory import router as market_memory_router\nfrom app.api.performance_feedback import router as performance_feedback_router",
    )

if "app.include_router(performance_feedback_router)" not in text:
    text = text.replace(
        "app.include_router(market_memory_router)",
        "app.include_router(market_memory_router)\napp.include_router(performance_feedback_router)",
    )

main_path.write_text(text)

print("performance_feedback router added to main.py")
