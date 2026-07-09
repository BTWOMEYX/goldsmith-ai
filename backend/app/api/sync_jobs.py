import asyncio
import json
import uuid
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from fastapi import APIRouter, Query

router = APIRouter(
    prefix="/api",
    tags=["Sync Jobs"],
)

JOBS: dict[str, dict] = {}
JOB_ORDER: list[str] = []
JOB_LOCK = asyncio.Lock()

INTERNAL_API_BASE_URL = "http://127.0.0.1:8000/api"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_empty_stats() -> dict:
    return {
        "auctions_downloaded": 0,
        "items_scanned": 0,
        "market_snapshots_saved": 0,
        "opportunities_unlocked": 0,
        "snapshots_saved": 0,
        "candidates_found": 0,
        "metadata_enriched": 0,
        "passed_profitability_buffers": 0,
        "ignored_count": 0,
        "auto_watch_added": 0,
    }


def build_url(path: str, params: dict) -> str:
    query_string = urllib.parse.urlencode(params)
    return f"{INTERNAL_API_BASE_URL}{path}?{query_string}"


def post_json(url: str, timeout: int) -> dict:
    request = urllib.request.Request(
        url=url,
        method="POST",
        headers={
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw_body = response.read().decode("utf-8")

            if not raw_body:
                return {
                    "status": "Success",
                }

            return json.loads(raw_body)

    except urllib.error.HTTPError as error:
        raw_body = error.read().decode("utf-8")

        try:
            parsed_body = json.loads(raw_body)
        except Exception:
            parsed_body = {
                "error": raw_body,
            }

        return {
            "status": "Error",
            "error": parsed_body.get("error")
            or parsed_body.get("detail")
            or f"HTTP {error.code}",
        }

    except Exception as error:
        return {
            "status": "Error",
            "error": str(error),
        }


def copy_sync_stats(sync_response: dict, auto_watch_response: dict | None = None) -> dict:
    auto_watch_response = auto_watch_response or {}

    return {
        "auctions_downloaded": int(sync_response.get("auctions_downloaded") or 0),
        "items_scanned": int(sync_response.get("items_scanned") or 0),
        "market_snapshots_saved": int(sync_response.get("market_snapshots_saved") or 0),
        "opportunities_unlocked": int(sync_response.get("opportunities_unlocked") or 0),
        "snapshots_saved": int(sync_response.get("snapshots_saved") or 0),
        "candidates_found": int(sync_response.get("candidates_found") or 0),
        "metadata_enriched": int(sync_response.get("metadata_enriched") or 0),
        "passed_profitability_buffers": int(
            sync_response.get("passed_profitability_buffers") or 0
        ),
        "ignored_count": int(auto_watch_response.get("ignored_count") or 0),
        "auto_watch_added": int(auto_watch_response.get("auto_watch_added") or 0),
    }


async def update_job(job_id: str, **updates) -> dict | None:
    async with JOB_LOCK:
        job = JOBS.get(job_id)

        if not job:
            return None

        job.update(updates)
        job["updated_at"] = utc_now()

        return dict(job)


async def get_job_copy(job_id: str) -> dict | None:
    async with JOB_LOCK:
        job = JOBS.get(job_id)

        if not job:
            return None

        return dict(job)


async def find_active_job(connected_realm_id: int | None = None) -> dict | None:
    async with JOB_LOCK:
        for job_id in reversed(JOB_ORDER):
            job = JOBS.get(job_id)

            if not job:
                continue

            if job["status"] not in ["queued", "running"]:
                continue

            if (
                connected_realm_id is not None
                and job["connected_realm_id"] != connected_realm_id
            ):
                continue

            return dict(job)

    return None


async def trim_old_jobs(max_jobs: int = 30) -> None:
    async with JOB_LOCK:
        while len(JOB_ORDER) > max_jobs:
            old_job_id = JOB_ORDER.pop(0)
            JOBS.pop(old_job_id, None)


async def advance_progress_until(
    job_id: str,
    stop_event: asyncio.Event,
    max_percent: int,
    phase: str,
    message: str,
) -> None:
    while not stop_event.is_set():
        job = await get_job_copy(job_id)

        if not job:
            return

        if job["status"] != "running":
            return

        current_progress = int(job.get("progress_percent") or 0)

        if current_progress < max_percent:
            await update_job(
                job_id,
                phase=phase,
                message=message,
                progress_percent=min(current_progress + 1, max_percent),
            )

        await asyncio.sleep(1.0)


async def run_sync_job(job_id: str) -> None:
    job = await get_job_copy(job_id)

    if not job:
        return

    connected_realm_id = job["connected_realm_id"]
    scan_mode = job["scan_mode"]

    try:
        await update_job(
            job_id,
            status="running",
            phase="starting",
            progress_percent=5,
            message="Starting backend sync job.",
            started_at=utc_now(),
        )

        await asyncio.sleep(0.5)

        await update_job(
            job_id,
            phase="downloading_auctions",
            progress_percent=12,
            message="Downloading auction house data from Blizzard.",
        )

        sync_url = build_url(
            "/sync-auctions",
            {
                "connected_realm_id": connected_realm_id,
                "scan_mode": scan_mode,
            },
        )

        stop_progress = asyncio.Event()

        progress_task = asyncio.create_task(
            advance_progress_until(
                job_id=job_id,
                stop_event=stop_progress,
                max_percent=86,
                phase="running_market_engine",
                message="Capturing market data and scoring opportunities.",
            )
        )

        sync_response = await asyncio.to_thread(
            post_json,
            sync_url,
            60 * 10,
        )

        stop_progress.set()
        await progress_task

        if sync_response.get("status") != "Success":
            raise RuntimeError(
                sync_response.get("error")
                or sync_response.get("message")
                or "Sync endpoint returned an error."
            )

        await update_job(
            job_id,
            phase="applying_filters",
            progress_percent=88,
            message="Applying ignore rules, deal filters and capital guardrails.",
            sync_response=sync_response,
            stats=copy_sync_stats(sync_response),
        )

        await asyncio.sleep(0.5)

        await update_job(
            job_id,
            phase="running_auto_watch",
            progress_percent=94,
            message="Running Auto Watch against clean opportunities.",
        )

        auto_watch_url = build_url(
            "/deals/auto-watch",
            {
                "connected_realm_id": connected_realm_id,
                "limit": 10,
            },
        )

        auto_watch_response = await asyncio.to_thread(
            post_json,
            auto_watch_url,
            60 * 2,
        )

        if auto_watch_response.get("status") != "Success":
            auto_watch_response = {
                "status": "Error",
                "auto_watch_added": 0,
                "ignored_count": 0,
                "error": auto_watch_response.get("error")
                or "Auto Watch failed after sync.",
            }

        final_stats = copy_sync_stats(
            sync_response=sync_response,
            auto_watch_response=auto_watch_response,
        )

        await update_job(
            job_id,
            status="complete",
            phase="complete",
            progress_percent=100,
            message="Sync complete. Market data, deal alerts and watchlist are ready.",
            completed_at=utc_now(),
            stats=final_stats,
            sync_response=sync_response,
            auto_watch_response=auto_watch_response,
        )

    except Exception as error:
        await update_job(
            job_id,
            status="failed",
            phase="failed",
            progress_percent=100,
            message="Sync job failed.",
            error=str(error),
            completed_at=utc_now(),
        )


@router.post("/sync-jobs/start")
async def start_sync_job(
    connected_realm_id: int = Query(default=11),
    scan_mode: str = Query(default="quick"),
):
    scan_mode = scan_mode.lower().strip()

    if scan_mode not in ["quick", "full"]:
        return {
            "status": "Error",
            "error": "scan_mode must be quick or full.",
            "job": None,
        }

    active_job = await find_active_job(connected_realm_id=connected_realm_id)

    if active_job:
        return {
            "status": "Existing",
            "message": "A sync job is already running for this realm.",
            "job": active_job,
        }

    job_id = str(uuid.uuid4())

    job = {
        "job_id": job_id,
        "status": "queued",
        "scan_mode": scan_mode,
        "connected_realm_id": connected_realm_id,
        "realm_name": f"Connected Realm {connected_realm_id}",
        "phase": "queued",
        "progress_percent": 0,
        "message": "Sync job queued.",
        "stats": create_empty_stats(),
        "error": None,
        "sync_response": None,
        "auto_watch_response": None,
        "created_at": utc_now(),
        "started_at": None,
        "completed_at": None,
        "updated_at": utc_now(),
    }

    async with JOB_LOCK:
        JOBS[job_id] = job
        JOB_ORDER.append(job_id)

    await trim_old_jobs()

    asyncio.create_task(run_sync_job(job_id))

    return {
        "status": "Success",
        "message": "Sync job started.",
        "job": job,
    }


@router.get("/sync-jobs/active")
async def get_active_sync_job(
    connected_realm_id: int | None = Query(default=None),
):
    active_job = await find_active_job(connected_realm_id=connected_realm_id)

    return {
        "status": "Success",
        "job": active_job,
    }


@router.get("/sync-jobs/history")
async def get_sync_job_history(
    limit: int = Query(default=10, ge=1, le=30),
):
    async with JOB_LOCK:
        job_ids = list(reversed(JOB_ORDER))[:limit]
        jobs = [dict(JOBS[job_id]) for job_id in job_ids if job_id in JOBS]

    return {
        "status": "Success",
        "job_count": len(jobs),
        "items": jobs,
    }


@router.get("/sync-jobs/{job_id}")
async def get_sync_job(
    job_id: str,
):
    job = await get_job_copy(job_id)

    if not job:
        return {
            "status": "Error",
            "error": "Sync job not found.",
            "job": None,
        }

    return {
        "status": "Success",
        "job": job,
    }
