import asyncio
import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

router = APIRouter(
    prefix="/api",
    tags=["AutoPilot"],
)

INTERNAL_API_BASE_URL = "http://127.0.0.1:8000/api"

AUTOPILOT_TASK: asyncio.Task | None = None
AUTOPILOT_LOCK = asyncio.Lock()

AUTOPILOT_STATE = {
    "enabled": False,
    "connected_realm_id": 11,
    "quick_interval_minutes": 60,
    "full_interval_minutes": 240,
    "check_every_seconds": 30,
    "last_quick_started_at": None,
    "last_full_started_at": None,
    "last_job_id": None,
    "last_scan_mode": None,
    "last_message": "AutoPilot is stopped.",
    "run_count": 0,
    "error_count": 0,
    "last_error": None,
    "started_at": None,
    "updated_at": None,
}


class AutoPilotSettingsPayload(BaseModel):
    connected_realm_id: int = Field(default=11, ge=1)
    quick_interval_minutes: int = Field(default=60, ge=15, le=1440)
    full_interval_minutes: int = Field(default=240, ge=30, le=2880)
    check_every_seconds: int = Field(default=30, ge=15, le=300)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None

    try:
        return datetime.fromisoformat(value)
    except Exception:
        return None


def build_url(path: str, params: dict | None = None) -> str:
    if not params:
        return f"{INTERNAL_API_BASE_URL}{path}"

    query_string = urllib.parse.urlencode(params)
    return f"{INTERNAL_API_BASE_URL}{path}?{query_string}"


def request_json(url: str, method: str = "GET", timeout: int = 30) -> dict:
    request = urllib.request.Request(
        url=url,
        method=method,
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


async def get_active_job(connected_realm_id: int) -> dict | None:
    url = build_url(
        "/sync-jobs/active",
        {
            "connected_realm_id": connected_realm_id,
        },
    )

    response = await asyncio.to_thread(request_json, url, "GET", 10)

    if response.get("status") != "Success":
        return None

    return response.get("job")


async def start_sync_job(scan_mode: str, connected_realm_id: int) -> dict:
    url = build_url(
        "/sync-jobs/start",
        {
            "connected_realm_id": connected_realm_id,
            "scan_mode": scan_mode,
        },
    )

    return await asyncio.to_thread(request_json, url, "POST", 30)


def get_next_due_at(last_started_at: str | None, interval_minutes: int) -> str:
    parsed_last = parse_dt(last_started_at)

    if not parsed_last:
        return "Due now"

    return (parsed_last + timedelta(minutes=interval_minutes)).isoformat()


def is_due(last_started_at: str | None, interval_minutes: int) -> bool:
    parsed_last = parse_dt(last_started_at)

    if not parsed_last:
        return True

    return utc_now() >= parsed_last + timedelta(minutes=interval_minutes)


def build_status() -> dict:
    return {
        **AUTOPILOT_STATE,
        "next_quick_due_at": get_next_due_at(
            AUTOPILOT_STATE["last_quick_started_at"],
            AUTOPILOT_STATE["quick_interval_minutes"],
        ),
        "next_full_due_at": get_next_due_at(
            AUTOPILOT_STATE["last_full_started_at"],
            AUTOPILOT_STATE["full_interval_minutes"],
        ),
    }


async def mark_job_started(scan_mode: str, response: dict) -> None:
    job = response.get("job") or {}
    now = utc_now_iso()

    AUTOPILOT_STATE["run_count"] += 1
    AUTOPILOT_STATE["last_job_id"] = job.get("job_id")
    AUTOPILOT_STATE["last_scan_mode"] = scan_mode
    AUTOPILOT_STATE["last_message"] = (
        f"Started {scan_mode} sync job."
        if response.get("status") == "Success"
        else response.get("message", f"{scan_mode} sync job requested.")
    )
    AUTOPILOT_STATE["updated_at"] = now

    if scan_mode == "quick":
        AUTOPILOT_STATE["last_quick_started_at"] = now

    if scan_mode == "full":
        AUTOPILOT_STATE["last_full_started_at"] = now


async def run_due_scan(scan_mode: str) -> None:
    connected_realm_id = AUTOPILOT_STATE["connected_realm_id"]

    active_job = await get_active_job(connected_realm_id)

    if active_job:
        AUTOPILOT_STATE["last_message"] = "Waiting for active sync job to finish."
        AUTOPILOT_STATE["updated_at"] = utc_now_iso()
        return

    response = await start_sync_job(
        scan_mode=scan_mode,
        connected_realm_id=connected_realm_id,
    )

    if response.get("status") in ["Success", "Existing"]:
        await mark_job_started(scan_mode, response)
        return

    AUTOPILOT_STATE["error_count"] += 1
    AUTOPILOT_STATE["last_error"] = response.get("error") or "Unable to start sync job."
    AUTOPILOT_STATE["last_message"] = "AutoPilot failed to start a sync job."
    AUTOPILOT_STATE["updated_at"] = utc_now_iso()


async def autopilot_loop() -> None:
    while AUTOPILOT_STATE["enabled"]:
        try:
            if is_due(
                AUTOPILOT_STATE["last_full_started_at"],
                AUTOPILOT_STATE["full_interval_minutes"],
            ):
                await run_due_scan("full")

            elif is_due(
                AUTOPILOT_STATE["last_quick_started_at"],
                AUTOPILOT_STATE["quick_interval_minutes"],
            ):
                await run_due_scan("quick")

            else:
                AUTOPILOT_STATE["last_message"] = "AutoPilot is monitoring schedule."
                AUTOPILOT_STATE["updated_at"] = utc_now_iso()

        except Exception as error:
            AUTOPILOT_STATE["error_count"] += 1
            AUTOPILOT_STATE["last_error"] = str(error)
            AUTOPILOT_STATE["last_message"] = "AutoPilot loop error."
            AUTOPILOT_STATE["updated_at"] = utc_now_iso()

        await asyncio.sleep(AUTOPILOT_STATE["check_every_seconds"])

    AUTOPILOT_STATE["last_message"] = "AutoPilot is stopped."
    AUTOPILOT_STATE["updated_at"] = utc_now_iso()


async def ensure_autopilot_task() -> None:
    global AUTOPILOT_TASK

    if AUTOPILOT_TASK and not AUTOPILOT_TASK.done():
        return

    AUTOPILOT_TASK = asyncio.create_task(autopilot_loop())


@router.get("/autopilot/status")
async def get_autopilot_status():
    active_job = await get_active_job(AUTOPILOT_STATE["connected_realm_id"])

    return {
        "status": "Success",
        "autopilot": build_status(),
        "active_job": active_job,
    }


@router.post("/autopilot/settings")
async def update_autopilot_settings(payload: AutoPilotSettingsPayload):
    async with AUTOPILOT_LOCK:
        AUTOPILOT_STATE["connected_realm_id"] = payload.connected_realm_id
        AUTOPILOT_STATE["quick_interval_minutes"] = payload.quick_interval_minutes
        AUTOPILOT_STATE["full_interval_minutes"] = payload.full_interval_minutes
        AUTOPILOT_STATE["check_every_seconds"] = payload.check_every_seconds
        AUTOPILOT_STATE["updated_at"] = utc_now_iso()
        AUTOPILOT_STATE["last_message"] = "AutoPilot settings updated."

    return {
        "status": "Success",
        "autopilot": build_status(),
    }


@router.post("/autopilot/start")
async def start_autopilot(
    run_now: bool = Query(default=True),
):
    async with AUTOPILOT_LOCK:
        AUTOPILOT_STATE["enabled"] = True
        AUTOPILOT_STATE["started_at"] = AUTOPILOT_STATE["started_at"] or utc_now_iso()
        AUTOPILOT_STATE["updated_at"] = utc_now_iso()
        AUTOPILOT_STATE["last_message"] = "AutoPilot started."

        if AUTOPILOT_STATE["last_full_started_at"] is None:
            AUTOPILOT_STATE["last_full_started_at"] = utc_now_iso()

    await ensure_autopilot_task()

    if run_now:
        await run_due_scan("quick")

    return {
        "status": "Success",
        "autopilot": build_status(),
    }


@router.post("/autopilot/stop")
async def stop_autopilot():
    async with AUTOPILOT_LOCK:
        AUTOPILOT_STATE["enabled"] = False
        AUTOPILOT_STATE["updated_at"] = utc_now_iso()
        AUTOPILOT_STATE["last_message"] = "AutoPilot stopped."

    return {
        "status": "Success",
        "autopilot": build_status(),
    }


@router.post("/autopilot/run-now")
async def autopilot_run_now(
    scan_mode: str = Query(default="quick"),
):
    scan_mode = scan_mode.lower().strip()

    if scan_mode not in ["quick", "full"]:
        return {
            "status": "Error",
            "error": "scan_mode must be quick or full.",
            "autopilot": build_status(),
        }

    response = await start_sync_job(
        scan_mode=scan_mode,
        connected_realm_id=AUTOPILOT_STATE["connected_realm_id"],
    )

    if response.get("status") in ["Success", "Existing"]:
        await mark_job_started(scan_mode, response)

        return {
            "status": "Success",
            "message": f"{scan_mode} sync job requested.",
            "autopilot": build_status(),
            "job": response.get("job"),
        }

    AUTOPILOT_STATE["error_count"] += 1
    AUTOPILOT_STATE["last_error"] = response.get("error") or "Unable to start sync job."
    AUTOPILOT_STATE["last_message"] = "Manual AutoPilot run failed."
    AUTOPILOT_STATE["updated_at"] = utc_now_iso()

    return {
        "status": "Error",
        "error": AUTOPILOT_STATE["last_error"],
        "autopilot": build_status(),
    }
