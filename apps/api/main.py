import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apps.api.routers.wallet import router as wallet_router

app = FastAPI(
    title="Wallet Intelligence API",
    description="Solana Wallet Intelligence & Trader Analytics Engine API",
    version="1.0.0",
)

# CORS Middleware
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(wallet_router)


@app.get("/healthz", tags=["System"])
async def health_check():
    """Service health check endpoint."""
    return {"status": "ok", "service": "wallet-intelligence-api"}


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("apps.api.main:app", host=host, port=port, reload=True)
