from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter()


class SyncRequest(BaseModel):
    system_id: str = Field(..., description="ID игровой системы в game-systems")
    version_id: str = Field(..., description="ID версии системы")
    group_id: int = Field(..., description="ID группы (campaign), куда синхронизировать")


class SyncResponse(BaseModel):
    job_id: str
    status: str


@router.post("/sync", response_model=SyncResponse)
async def start_sync(req: SyncRequest, request: Request) -> SyncResponse:
    """Эндпоинт «Синхронизировать»: запускает синхронизацию асинхронно."""
    jobs: JobManager = request.app.state.jobs
    job = jobs.start(req.system_id, req.version_id, req.group_id)
    return SyncResponse(job_id=job["id"], status=job["status"])


@router.get("/sync/{job_id}")
async def get_sync(job_id: str, request: Request) -> dict:
    """Статус и результат задачи синхронизации."""
    jobs: JobManager = request.app.state.jobs
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/sync")
async def list_sync(request: Request) -> dict:
    """Список всех запусков синхронизации."""
    jobs: JobManager = request.app.state.jobs
    return {"jobs": jobs.list()}
