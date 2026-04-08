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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI(title="OpenClaw Mission Control API")

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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ConversationCreate(BaseModel):
    title: Optional[str] = "New conversation"
    model_id: Optional[str] = None
    provider: Optional[str] = None

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
    return {"message": "OpenClaw Mission Control API", "status": "operational"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# ==================== CONVERSATIONS ====================

@api_router.get("/conversations", response_model=List[Conversation])
async def get_conversations():
    conversations = await db.conversations.find({}, {"_id": 0}).sort("updated_at", -1).to_list(100)
    for conv in conversations:
        if isinstance(conv.get('created_at'), str):
            conv['created_at'] = datetime.fromisoformat(conv['created_at'])
        if isinstance(conv.get('updated_at'), str):
            conv['updated_at'] = datetime.fromisoformat(conv['updated_at'])
    return conversations

@api_router.post("/conversations", response_model=Conversation)
async def create_conversation(input: ConversationCreate):
    conv = Conversation(**input.model_dump())
    doc = conv.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.conversations.insert_one(doc)
    return conv

@api_router.get("/conversations/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str):
    conv = await db.conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv

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
    
    user_message = {
        "role": "user",
        "content": message.content,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Mock assistant response
    assistant_message = {
        "role": "assistant",
        "content": f"I received your message: '{message.content}'. This is a placeholder response from the OpenClaw Mission Control system.",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.conversations.update_one(
        {"id": conversation_id},
        {
            "$push": {"messages": {"$each": [user_message, assistant_message]}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
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
            ]
        },
        "openai": {
            "id": "openai",
            "name": "OpenAI",
            "models": [
                {"id": "gpt-4-turbo", "name": "gpt-4-turbo", "context": "128K"},
                {"id": "gpt-4o", "name": "gpt-4o", "context": "128K"},
                {"id": "gpt-4o-mini", "name": "gpt-4o-mini", "context": "128K"},
            ]
        },
        "google": {
            "id": "google",
            "name": "Google",
            "models": [
                {"id": "gemini-pro", "name": "gemini-pro", "context": "32K"},
                {"id": "gemini-ultra", "name": "gemini-ultra", "context": "32K"},
            ]
        },
        "nvidia": {
            "id": "nvidia",
            "name": "NVIDIA",
            "models": [
                {"id": "nemotron-3-super-120b-a12b", "name": "nemotron-3-super-120b-a12b", "context": "128K"},
                {"id": "nemotron-3-super-120b-a12b-free", "name": "nemotron-3-super-120b-a12b:free", "context": "262K"},
                {"id": "nemotron-nano-12b-v2-vl-free", "name": "nemotron-nano-12b-v2-vl:free", "context": "128K"},
            ]
        },
        "meta-llama": {
            "id": "meta-llama",
            "name": "Meta LLaMA",
            "models": [
                {"id": "llama-3-70b", "name": "llama-3-70b-instruct", "context": "8K"},
                {"id": "llama-3-8b", "name": "llama-3-8b-instruct", "context": "8K"},
            ]
        },
        "deepseek": {
            "id": "deepseek",
            "name": "DeepSeek",
            "models": [
                {"id": "deepseek-coder", "name": "deepseek-coder-33b", "context": "16K"},
                {"id": "deepseek-chat", "name": "deepseek-chat", "context": "32K"},
            ]
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
            {"id": "deep-research", "name": "deep-research", "description": "Comprehensive research", "icon": "search", "enabled": True},
            {"id": "code-review", "name": "code-review", "description": "Code analysis and review", "icon": "file-text", "enabled": True},
            {"id": "web-scraper", "name": "web-scraper", "description": "Web content extraction", "icon": "globe", "enabled": True},
            {"id": "file-manager", "name": "file-manager", "description": "File operations", "icon": "folder", "enabled": True},
            {"id": "task-scheduler", "name": "task-scheduler", "description": "Schedule tasks", "icon": "briefcase", "enabled": True},
            {"id": "mcp-builder", "name": "mcp-builder", "description": "MCP protocol builder", "icon": "puzzle", "enabled": True},
            {"id": "slack-gif-creator", "name": "slack-gif-creator", "description": "Create Slack GIFs", "icon": "image", "enabled": False},
            {"id": "canvas-design", "name": "canvas-design", "description": "Design canvas", "icon": "palette", "enabled": False},
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
            {"id": "job-1", "name": "Code Analysis Task", "status": "running", "progress": 65},
            {"id": "job-2", "name": "Web Scraping Job", "status": "completed", "progress": 100},
            {"id": "job-3", "name": "Research Task", "status": "pending", "progress": 0},
        ]
    return jobs

@api_router.post("/jobs")
async def create_job(name: str):
    job = Job(name=name)
    doc = job.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.jobs.insert_one(doc)
    return job

# ==================== APPROVALS ====================

@api_router.get("/approvals", response_model=List[Dict[str, Any]])
async def get_approvals():
    approvals = await db.approvals.find({}, {"_id": 0}).to_list(100)
    if not approvals:
        # Return mock approvals
        return [
            {"id": "approval-1", "title": "File Access Request", "description": "Agent requests access to /config", "status": "pending"},
            {"id": "approval-2", "title": "External API Call", "description": "Agent wants to call external service", "status": "pending"},
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
        {"id": "user_settings"},
        {"$set": settings.model_dump()},
        upsert=True
    )
    return settings

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
