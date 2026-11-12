from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.clients.game_systems import GameSystemsClient
from app.clients.campaign import CampaignClient
from app.core.state import SyncStateStore
from app.core.sync import SyncEngine
from app.jobs import JobManager
from app.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    gs = GameSystemsClient(settings.game_systems_url)
    camp = CampaignClient(settings.campaign_url)
    state = SyncStateStore(settings.state_file)
    engine = SyncEngine(gs, camp, state)
    app.state.jobs = JobManager(engine)
    yield
    await gs.aclose()
    await camp.aclose()


app = FastAPI(title="sync-service", version="0.1.0", lifespan=lifespan)
app.include_router(router)
