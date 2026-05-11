"""FastAPI router for /api/v2/design/* — D-Studio creative playground.

Contract: D_STUDIO_HANDOFF.md §2.2.

Status: STUB — all endpoints return {available: false, error: "no_provider"}
until design.provider.image is set to something other than "none" via the
Phase 0.1 config bus. When provider is "none", the frontend renders an
ErrorState with a "Configure provider" Fix button per §0.5.
"""

from __future__ import annotations

import logging
import time
from typing import Optional

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

design_router = APIRouter(prefix="/api/v2/design", tags=["design"])


# ---- Request/Response models (§2.2 contracts) ----

class GenerateRequest(BaseModel):
    prompt: str
    mode: str = "image"  # image | video
    aspect: str = "1:1"
    quality: str = "balanced"  # speed | balanced | quality
    refs: list[str] = []
    project_id: Optional[str] = None
    parent_node_id: Optional[str] = None


class ProjectCreateRequest(BaseModel):
    name: str = "Untitled Project"


class ProjectUpdateRequest(BaseModel):
    name: Optional[str] = None
    nodes: Optional[list] = None
    edges: Optional[list] = None


class VideoRequest(BaseModel):
    source_image_id: str
    motion_prompt: Optional[str] = None
    duration_s: float = 4.0


# ---- Helper ----

def _stub_response(detail: str = "Design module is a stub — no provider configured") -> dict:
    return {
        "available": False,
        "error": "no_provider",
        "fix": [
            {
                "label": "Configure provider",
                "action": "open_settings",
                "args": {"category": "design"},
            }
        ],
        "detail": detail,
        "ts": time.time() * 1000,
    }


# ---- Generation endpoints ----

@design_router.get("/generations")
async def list_generations(
    project_id: Optional[str] = Query(None),
) -> JSONResponse:
    """List generations, optionally filtered by project_id. §2.2"""
    log.info("design/generations called (stub)")
    return JSONResponse(_stub_response("No provider configured — generations list unavailable"))


@design_router.post("/generate")
async def generate(req: GenerateRequest) -> JSONResponse:
    """Start a generation. §2.2 — body: {prompt, mode, aspect, quality, refs[], project_id?, parent_node_id?}"""
    log.info("design/generate called: prompt=%s mode=%s (stub)", req.prompt[:40], req.mode)
    return JSONResponse(_stub_response("No provider configured — cannot start generation"), status_code=503)


@design_router.get("/generations/{generation_id}")
async def get_generation(generation_id: str) -> JSONResponse:
    """Get status + result for one generation. §2.2"""
    log.info("design/generations/%s called (stub)", generation_id)
    return JSONResponse(_stub_response("No provider configured — generation status unavailable"))


@design_router.delete("/generations/{generation_id}")
async def delete_generation(generation_id: str) -> JSONResponse:
    """Delete a generation output. §2.2"""
    log.info("design/generations/%s DELETE called (stub)", generation_id)
    return JSONResponse(_stub_response("No provider configured — cannot delete generation"), status_code=503)


# ---- Project (canvas) endpoints ----

@design_router.get("/projects")
async def list_projects() -> JSONResponse:
    """List saved canvases. §2.2"""
    log.info("design/projects called (stub)")
    return JSONResponse(_stub_response("No provider configured — projects list unavailable"))


@design_router.post("/projects")
async def create_project(req: ProjectCreateRequest) -> JSONResponse:
    """Create a new canvas. §2.2"""
    log.info("design/projects POST: name=%s (stub)", req.name)
    return JSONResponse(_stub_response("No provider configured — cannot create project"), status_code=503)


@design_router.get("/projects/{project_id}")
async def get_project(project_id: str) -> JSONResponse:
    """Load canvas (nodes + edges). §2.2"""
    log.info("design/projects/%s called (stub)", project_id)
    return JSONResponse(_stub_response("No provider configured — project load unavailable"))


@design_router.put("/projects/{project_id}")
async def update_project(project_id: str, req: ProjectUpdateRequest) -> JSONResponse:
    """Save canvas state. §2.2"""
    log.info("design/projects/%s PUT called (stub)", project_id)
    return JSONResponse(_stub_response("No provider configured — cannot save project"), status_code=503)


@design_router.delete("/projects/{project_id}")
async def delete_project(project_id: str) -> JSONResponse:
    """Delete a canvas. §2.2"""
    log.info("design/projects/%s DELETE called (stub)", project_id)
    return JSONResponse(_stub_response("No provider configured — cannot delete project"), status_code=503)


# ---- Upload & video ----

@design_router.post("/upload")
async def upload_reference() -> JSONResponse:
    """Upload a reference image. §2.2 — multipart, returns {ref_id, url, dims}."""
    log.info("design/upload called (stub)")
    return JSONResponse(_stub_response("No provider configured — cannot upload reference"), status_code=503)


@design_router.post("/video")
async def generate_video(req: VideoRequest) -> JSONResponse:
    """Image → video. §2.2 — body: {source_image_id, motion_prompt?, duration_s}."""
    log.info("design/video called: source=%s (stub)", req.source_image_id)
    return JSONResponse(_stub_response("No provider configured — cannot generate video"), status_code=503)


# TODO: builder scaffold
