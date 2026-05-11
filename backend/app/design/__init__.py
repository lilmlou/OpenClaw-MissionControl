"""Design module — D-Studio creative playground backend.

Contract: D_STUDIO_HANDOFF.md §2.

Status: STUB — endpoints return {available: false, error: "no_provider"}
until a provider is configured via the config bus.

Endpoints (§2.2):
  GET    /api/v2/design/generations         — list generations
  POST   /api/v2/design/generate            — start generation
  GET    /api/v2/design/generations/{id}     — single generation status
  DELETE /api/v2/design/generations/{id}     — delete output
  GET    /api/v2/design/projects            — list canvases
  POST   /api/v2/design/projects            — create canvas
  GET    /api/v2/design/projects/{id}       — load canvas
  PUT    /api/v2/design/projects/{id}       — save canvas
  DELETE /api/v2/design/projects/{id}       — delete canvas
  POST   /api/v2/design/upload              — upload reference
  POST   /api/v2/design/video               — image → video
  WS     /api/ws/design                     — live progress + canvas updates

Bus keys (§2.3): design.provider.image, design.provider.video,
  design.providers.*.api_key, design.default_model.*,
  design.default_aspect, design.default_quality, design.cost_cap_per_day_usd

Mongo collections: design_projects, design_generations, design_references
"""

from .routes import design_router

__all__ = ["design_router"]

# TODO: builder scaffold
