from pathlib import Path

main_path = Path(r"F:\Projects\goldsmith-ai\backend\app\main.py")
text = main_path.read_text()

if "from app.api.sync_jobs import router as sync_jobs_router" not in text:
    text = text.replace(
        "from app.api.sync import router as sync_router",
        "from app.api.sync import router as sync_router\nfrom app.api.sync_jobs import router as sync_jobs_router",
    )

if "app.include_router(sync_jobs_router)" not in text:
    text = text.replace(
        "app.include_router(sync_router)",
        "app.include_router(sync_router)\napp.include_router(sync_jobs_router)",
    )

main_path.write_text(text)

print("sync_jobs router added to main.py")
