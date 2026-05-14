from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone

from runtime_adapters.registry import get_runtime_adapter

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB connection
# Lazy-resolve at import time so test collection / clean-checkout pytest
# does not crash on KeyError when MONGO_URL/DB_NAME are absent. The real
# values are required at runtime; tests can stub via env or conftest.
mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "test_mc")]

# Create the main app
app = FastAPI(title="Mietorè Mission Control API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================


class Conversation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = "New conversation"
    messages: List[Dict[str, Any]] = []
    model_id: Optional[str] = None
    provider: Optional[str] = None
    runtime: str = "openclaw"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ConversationCreate(BaseModel):
    title: Optional[str] = "New conversation"
    model_id: Optional[str] = None
    provider: Optional[str] = None
    runtime: str = "openclaw"


class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MessageCreate(BaseModel):
    content: str


class ModelProvider(BaseModel):
    id: str
    name: str
    models: List[Dict[str, Any]]


class Skill(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    icon: str
    enabled: bool = True


class Job(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    status: str = "pending"  # pending, running, completed, failed
    progress: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Approval(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    status: str = "pending"  # pending, approved, rejected
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "user_settings"
    default_model: Optional[str] = None
    default_provider: Optional[str] = None
    web_search_enabled: bool = True
    agent_mode_enabled: bool = True
    writing_style: str = "normal"
    enabled_skills: List[str] = []


# ==================== ROUTES ====================


@api_router.get("/")
async def root():
    return {"message": "Mietorè Mission Control API", "status": "operational"}


@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


# ==================== CONVERSATIONS ====================


def normalize_conversation(conv: Dict[str, Any]) -> Dict[str, Any]:
    normalized = dict(conv)
    if isinstance(normalized.get("created_at"), str):
        normalized["created_at"] = datetime.fromisoformat(normalized["created_at"])
    if isinstance(normalized.get("updated_at"), str):
        normalized["updated_at"] = datetime.fromisoformat(normalized["updated_at"])
    normalized["runtime"] = normalized.get("runtime") or "openclaw"
    return normalized


@api_router.get("/conversations", response_model=List[Conversation])
async def get_conversations():
    conversations = (
        await db.conversations.find({}, {"_id": 0}).sort("updated_at", -1).to_list(100)
    )
    return [normalize_conversation(conv) for conv in conversations]


@api_router.post("/conversations", response_model=Conversation)
async def create_conversation(input: ConversationCreate):
    conv = Conversation(**input.model_dump())
    doc = conv.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await db.conversations.insert_one(doc)
    return conv


@api_router.get("/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str):
    conv = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return normalize_conversation(conv)


@api_router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str):
    result = await db.conversations.delete_one({"id": conversation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "deleted"}


@api_router.post("/conversations/{conversation_id}/messages")
async def add_message(conversation_id: str, message: MessageCreate):
    conv = await db.conversations.find_one({"id": conversation_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    normalized_conv = normalize_conversation(conv)

    user_message = {
        "role": "user",
        "content": message.content,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    adapter = get_runtime_adapter(normalized_conv["runtime"])
    assistant_payload = await adapter.send_message(
        conversation_id,
        message.content,
        {
            "model_id": normalized_conv.get("model_id"),
            "provider": normalized_conv.get("provider"),
            "runtime": normalized_conv.get("runtime"),
        },
    )
    assistant_message = {
        "role": "assistant",
        "content": assistant_payload["content"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "runtime": assistant_payload.get("runtime", normalized_conv["runtime"]),
    }

    await db.conversations.update_one(
        {"id": conversation_id},
        {
            "$push": {"messages": {"$each": [user_message, assistant_message]}},
            "$set": {
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "runtime": normalized_conv["runtime"],
            },
        },
    )

    return {"user_message": user_message, "assistant_message": assistant_message}


# ==================== MODELS/PROVIDERS ====================


@api_router.get("/providers")
async def get_providers():
    providers = {
        "anthropic": {
            "id": "anthropic",
            "name": "Anthropic",
            "models": [
                {"id": "claude-3-opus", "name": "claude-3-opus", "context": "200K"},
                {"id": "claude-3-sonnet", "name": "claude-3-sonnet", "context": "200K"},
                {"id": "claude-3-haiku", "name": "claude-3-haiku", "context": "200K"},
            ],
        },
        "openai": {
            "id": "openai",
            "name": "OpenAI",
            "models": [
                {"id": "gpt-4-turbo", "name": "gpt-4-turbo", "context": "128K"},
                {"id": "gpt-4o", "name": "gpt-4o", "context": "128K"},
                {"id": "gpt-4o-mini", "name": "gpt-4o-mini", "context": "128K"},
            ],
        },
        "google": {
            "id": "google",
            "name": "Google",
            "models": [
                {"id": "gemini-pro", "name": "gemini-pro", "context": "32K"},
                {"id": "gemini-ultra", "name": "gemini-ultra", "context": "32K"},
            ],
        },
        "nvidia": {
            "id": "nvidia",
            "name": "NVIDIA",
            "models": [
                {
                    "id": "nemotron-3-super-120b-a12b",
                    "name": "nemotron-3-super-120b-a12b",
                    "context": "128K",
                },
                {
                    "id": "nemotron-3-super-120b-a12b-free",
                    "name": "nemotron-3-super-120b-a12b:free",
                    "context": "262K",
                },
                {
                    "id": "nemotron-nano-12b-v2-vl-free",
                    "name": "nemotron-nano-12b-v2-vl:free",
                    "context": "128K",
                },
            ],
        },
        "meta-llama": {
            "id": "meta-llama",
            "name": "Meta LLaMA",
            "models": [
                {"id": "llama-3-70b", "name": "llama-3-70b-instruct", "context": "8K"},
                {"id": "llama-3-8b", "name": "llama-3-8b-instruct", "context": "8K"},
            ],
        },
        "deepseek": {
            "id": "deepseek",
            "name": "DeepSeek",
            "models": [
                {
                    "id": "deepseek-coder",
                    "name": "deepseek-coder-33b",
                    "context": "16K",
                },
                {"id": "deepseek-chat", "name": "deepseek-chat", "context": "32K"},
            ],
        },
    }
    return providers


# ==================== SKILLS ====================


@api_router.get("/skills", response_model=List[Dict[str, Any]])
async def get_skills():
    skills = await db.skills.find({}, {"_id": 0}).to_list(100)
    if not skills:
        # Return default skills
        default_skills = [
            {
                "id": "deep-research",
                "name": "deep-research",
                "description": "Comprehensive research",
                "icon": "search",
                "enabled": True,
            },
            {
                "id": "code-review",
                "name": "code-review",
                "description": "Code analysis and review",
                "icon": "file-text",
                "enabled": True,
            },
            {
                "id": "web-scraper",
                "name": "web-scraper",
                "description": "Web content extraction",
                "icon": "globe",
                "enabled": True,
            },
            {
                "id": "file-manager",
                "name": "file-manager",
                "description": "File operations",
                "icon": "folder",
                "enabled": True,
            },
            {
                "id": "task-scheduler",
                "name": "task-scheduler",
                "description": "Schedule tasks",
                "icon": "briefcase",
                "enabled": True,
            },
            {
                "id": "mcp-builder",
                "name": "mcp-builder",
                "description": "MCP protocol builder",
                "icon": "puzzle",
                "enabled": True,
            },
            {
                "id": "slack-gif-creator",
                "name": "slack-gif-creator",
                "description": "Create Slack GIFs",
                "icon": "image",
                "enabled": False,
            },
            {
                "id": "canvas-design",
                "name": "canvas-design",
                "description": "Design canvas",
                "icon": "palette",
                "enabled": False,
            },
        ]
        return default_skills
    return skills


@api_router.put("/skills/{skill_id}/toggle")
async def toggle_skill(skill_id: str):
    skill = await db.skills.find_one({"id": skill_id})
    if skill:
        new_state = not skill.get("enabled", True)
        await db.skills.update_one({"id": skill_id}, {"$set": {"enabled": new_state}})
        return {"id": skill_id, "enabled": new_state}
    return {"id": skill_id, "enabled": True}


# ==================== JOBS ====================


@api_router.get("/jobs", response_model=List[Dict[str, Any]])
async def get_jobs():
    jobs = await db.jobs.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    if not jobs:
        # Return mock jobs
        return [
            {
                "id": "job-1",
                "name": "Code Analysis Task",
                "status": "running",
                "progress": 65,
            },
            {
                "id": "job-2",
                "name": "Web Scraping Job",
                "status": "completed",
                "progress": 100,
            },
            {
                "id": "job-3",
                "name": "Research Task",
                "status": "pending",
                "progress": 0,
            },
        ]
    return jobs


@api_router.post("/jobs")
async def create_job(name: str):
    job = Job(name=name)
    doc = job.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["updated_at"] = doc["updated_at"].isoformat()
    await db.jobs.insert_one(doc)
    return job


# ==================== APPROVALS ====================


@api_router.get("/approvals", response_model=List[Dict[str, Any]])
async def get_approvals():
    approvals = await db.approvals.find({}, {"_id": 0}).to_list(100)
    if not approvals:
        # Return mock approvals
        return [
            {
                "id": "approval-1",
                "title": "File Access Request",
                "description": "Agent requests access to /config",
                "status": "pending",
            },
            {
                "id": "approval-2",
                "title": "External API Call",
                "description": "Agent wants to call external service",
                "status": "pending",
            },
        ]
    return approvals


@api_router.put("/approvals/{approval_id}/approve")
async def approve_request(approval_id: str):
    await db.approvals.update_one({"id": approval_id}, {"$set": {"status": "approved"}})
    return {"id": approval_id, "status": "approved"}


@api_router.put("/approvals/{approval_id}/reject")
async def reject_request(approval_id: str):
    await db.approvals.update_one({"id": approval_id}, {"$set": {"status": "rejected"}})
    return {"id": approval_id, "status": "rejected"}


# ==================== SETTINGS ====================


@api_router.get("/settings")
async def get_settings():
    settings = await db.settings.find_one({"id": "user_settings"}, {"_id": 0})
    if not settings:
        settings = Settings().model_dump()
    return settings


@api_router.put("/settings")
async def update_settings(settings: Settings):
    await db.settings.update_one(
        {"id": "user_settings"}, {"$set": settings.model_dump()}, upsert=True
    )
    return settings


# Include the router in the main app
app.include_router(api_router)

from approval_engine.router import approval_v2_router, set_db
from approval_engine.websocket import approval_ws_router
from gateway_ws import chat_ws_router
from app.system_v2.router import system_v2_router

# Phase 0.1 — Hot-Reload Config Bus
from app.config_bus import bus, config_router, config_ws_router, ws_broadcast
from app.config_bus import store as config_store
from app.config_bus import events as config_events
from app.config_bus import ws as config_ws_module
from app.config_bus.defaults import register_day_one
from app.activity import emitter as activity_emitter
from app.activity import activity_router, activity_ws_router, activity_ws_broadcast
from app.brain_config import register_brain_config_keys
from app.chat_config import register_chat_config_keys

# Phase 0.3 backend half — Actions registry
from app.actions import actions_router
from app.actions.builtins import register_builtins

# Phase 0.3 backend — Logs (BindLog endpoint stub)
from app.logs import logs_router

# P0 backend visual-mirror stubs
from app.design import design_router
from app.qudos import qudos_router
from app.models import models_router
from app.usage import usage_router

# F7 — Agent Live View
from app.agents import agents_router, agents_ws_router, ws_broadcast as agents_ws_broadcast
from app.agents import store as agents_store
from app.agents.defaults import register_agent_bus_keys

# VM-D1 — Blockers Mirror
from app.blockers import blockers_router, start_mirror_loop, get_last_replay
from app.blockers import blockers_store

# VM-D2 — Progress Pulse
from app.progress import progress_router, start_mirror_loop as start_progress_mirror_loop
from app.progress import get_last_replay as get_progress_last_replay
from app.progress import progress_store

set_db(db)
config_store.set_db(db)
activity_emitter.set_db(db)


async def _activity_fanout(event):  # type: ignore[no-untyped-def]
    """Fan an activity event to both the config WS hub and the dedicated activity WS hub."""
    try:
        await ws_broadcast(event)
    except Exception:  # noqa: BLE001
        pass
    try:
        await activity_ws_broadcast(event)
    except Exception:  # noqa: BLE001
        pass


activity_emitter.set_broadcaster(_activity_fanout)
agents_store.set_db(db)
blockers_store.set_db(db)
progress_store.set_db(db)
register_day_one()
register_agent_bus_keys()
register_brain_config_keys()
register_chat_config_keys()
register_builtins()
config_ws_module.register_replay_provider(get_last_replay)
config_ws_module.register_replay_provider(get_progress_last_replay)
config_events.install()

app.include_router(approval_v2_router)
app.include_router(approval_ws_router)
app.include_router(chat_ws_router)
app.include_router(system_v2_router)
app.include_router(config_router)
app.include_router(config_ws_router)
app.include_router(activity_router)
app.include_router(activity_ws_router)
app.include_router(actions_router)
app.include_router(logs_router)
app.include_router(design_router)
app.include_router(qudos_router)
app.include_router(models_router)
app.include_router(usage_router)
app.include_router(agents_router)
app.include_router(agents_ws_router)
app.include_router(blockers_router)
app.include_router(progress_router)


@app.on_event("startup")
async def _config_bus_startup() -> None:
    n = await bus.load_from_store()
    logging.getLogger(__name__).info("config bus loaded %d Mongo overrides", n)
    await start_mirror_loop(db)
    await start_progress_mirror_loop(db)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
