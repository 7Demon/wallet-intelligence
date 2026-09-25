import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apps.api.routers.wallet import router as wallet_router
from apps.api.routers.tracker import router as tracker_router

app = FastAPI(
    title="Wallet Intelligence API",
    description="Solana Wallet Intelligence & Trader Analytics Engine API",
    version="1.0.0",
)

# CORS Middleware
origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True if origins != ["*"] else False,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|123\.123\.\d+\.\d+)(:\d+)?$",
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(wallet_router)
app.include_router(tracker_router)


@app.get("/healthz", tags=["System"])
async def health_check():
    """Service health check endpoint."""
    return {"status": "ok", "service": "wallet-intelligence-api"}


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("apps.api.main:app", host=host, port=port, reload=True)
