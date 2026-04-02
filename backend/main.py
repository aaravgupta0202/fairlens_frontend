"""
main.py
FairLens Backend — FastAPI entry point.
Run locally: uvicorn main:app --reload
"""

import os
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.modules.analyse.analyse_route import router as analyse_router
from app.modules.audit.audit_route import router as audit_router

app = FastAPI(
    title="FairLens API",
    description="AI bias detection backend — text analysis + dataset fairness auditing.",
    version="2.0.0",
)
logging.basicConfig(level=logging.INFO)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# Build allowed-origins list from environment.
# FRONTEND_URL can be a comma-separated list for multi-origin deployments, e.g.:
#   FRONTEND_URL=https://fairlens.netlify.app,https://www.fairlens.ai
_raw = os.getenv("FRONTEND_URL", "")
_explicit = [o.strip() for o in _raw.split(",") if o.strip()]

# Always include the common local-dev origins so the app works out of the box
_local = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",   # vite preview
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

allow_origins = list(dict.fromkeys(_explicit + _local))  # deduplicate, preserve order

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=r"https?://.*\.netlify\.app",   # any Netlify preview URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(analyse_router)
app.include_router(audit_router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": "internal_server_error", "message": "Internal server error"},
    )

# ─── Health check ─────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "FairLens API v2.0 is running",
        "modes": ["text-analysis", "dataset-audit"],
        "allowed_origins": allow_origins,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
