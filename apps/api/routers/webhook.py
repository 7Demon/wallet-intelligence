import os
import secrets
from typing import Any, Dict, List, Optional, Union
import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.database.connection import get_db
from packages.database.models import Wallet
from workers.sync_worker import sync_wallet_history

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])

HELIUS_API_KEY = os.getenv("HELIUS_API_KEY")
HELIUS_WEBHOOK_SECRET = os.getenv("HELIUS_WEBHOOK_SECRET")


def verify_webhook_admin(authorization: Optional[str] = Header(None)) -> None:
    """Validate administrative secret for webhook management endpoints."""
    admin_secret = os.getenv("APP_ADMIN_SECRET") or os.getenv("HELIUS_WEBHOOK_SECRET")
    if not admin_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Admin secret or HELIUS_WEBHOOK_SECRET is not configured on server.",
        )
    if not authorization or not secrets.compare_digest(authorization, admin_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing administrative authorization secret.",
        )


class WebhookSetupRequest(BaseModel):
    webhook_url: str
    auth_header: Optional[str] = None


@router.post("/helius", status_code=status.HTTP_200_OK)
async def receive_helius_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
):
    """
    Ingest real-time Solana transaction events pushed by Helius Webhook.
    Automatically detects if any tracked wallet is involved and schedules an
    immediate incremental delta-sync in the background.
    """
    # 1. Verify Secret Header (Fail-closed with constant-time comparison)
    expected_secret = os.getenv("HELIUS_WEBHOOK_SECRET")
    if not expected_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="HELIUS_WEBHOOK_SECRET is not configured on server.",
        )
    if not authorization or not secrets.compare_digest(authorization, expected_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing webhook authorization secret.",
        )

    try:
        body = await request.json()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid JSON payload: {str(e)}",
        )

    # Normalize payload into a list of transactions
    transactions: List[Dict[str, Any]] = []
    if isinstance(body, list):
        transactions = body
    elif isinstance(body, dict):
        transactions = [body]
    else:
        return {"status": "ok", "message": "Ignored empty or invalid payload", "matched_wallets": []}

    # 2. Extract all unique involved accounts from transactions
    involved_accounts = set()
    for tx in transactions:
        if not isinstance(tx, dict):
            continue

        # Extract fee payer
        if tx.get("feePayer"):
            involved_accounts.add(tx["feePayer"])

        # Extract native transfers
        for nt in tx.get("nativeTransfers", []):
            if isinstance(nt, dict):
                if nt.get("fromUserAccount"):
                    involved_accounts.add(nt["fromUserAccount"])
                if nt.get("toUserAccount"):
                    involved_accounts.add(nt["toUserAccount"])

        # Extract token transfers
        for tt in tx.get("tokenTransfers", []):
            if isinstance(tt, dict):
                if tt.get("fromUserAccount"):
                    involved_accounts.add(tt["fromUserAccount"])
                if tt.get("toUserAccount"):
                    involved_accounts.add(tt["toUserAccount"])

        # Extract account data list
        for ad in tx.get("accountData", []):
            if isinstance(ad, dict) and ad.get("account"):
                involved_accounts.add(ad["account"])

        # Extract raw message accountKeys if present
        msg = tx.get("transaction", {}).get("message", {})
        if isinstance(msg, dict):
            for k in msg.get("accountKeys", []):
                pubkey = k.get("pubkey") if isinstance(k, dict) else k
                if pubkey:
                    involved_accounts.add(pubkey)

    if not involved_accounts:
        return {"status": "ok", "matched_wallets": [], "transactions_processed": len(transactions)}

    # 3. Match against currently tracked wallets in database
    stmt = select(Wallet.address).where(
        Wallet.address.in_(list(involved_accounts)),
        Wallet.is_tracked == True,
    )
    res = await db.execute(stmt)
    matched_addresses = res.scalars().all()

    # 4. Trigger asynchronous incremental delta-sync for matched tracked wallets
    for addr in matched_addresses:
        background_tasks.add_task(sync_wallet_history, addr)

    return {
        "status": "ok",
        "transactions_received": len(transactions),
        "matched_wallets": matched_addresses,
        "message": f"Enqueued real-time delta sync for {len(matched_addresses)} tracked wallet(s).",
    }


@router.get("/helius/status")
async def get_helius_webhook_status(db: AsyncSession = Depends(get_db)):
    """Check webhook engine configuration and tracked wallets count."""
    api_key_set = bool(os.getenv("HELIUS_API_KEY"))
    secret_set = bool(os.getenv("HELIUS_WEBHOOK_SECRET"))

    stmt = select(Wallet.address).where(Wallet.is_tracked == True)
    res = await db.execute(stmt)
    tracked_addresses = res.scalars().all()

    return {
        "configured": api_key_set,
        "secret_protected": secret_set,
        "tracked_wallets_count": len(tracked_addresses),
        "tracked_addresses": tracked_addresses,
    }


@router.post("/helius/setup")
async def setup_helius_webhook(
    req: WebhookSetupRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(verify_webhook_admin),
):
    """
    Helper endpoint to automatically register or update the webhook with Helius API
    containing all currently tracked wallets from the database.
    """
    # Validate webhook_url
    clean_url = req.webhook_url.strip()
    if not (clean_url.startswith("https://") or clean_url.startswith("http://localhost") or clean_url.startswith("http://127.0.0.1")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook URL must be a valid HTTPS URL (or localhost/127.0.0.1 for development).",
        )

    api_key = os.getenv("HELIUS_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="HELIUS_API_KEY is not configured in .env",
        )

    # Fetch all active tracked wallet addresses
    stmt = select(Wallet.address).where(Wallet.is_tracked == True)
    res = await db.execute(stmt)
    tracked_addresses = res.scalars().all()

    if not tracked_addresses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tracked wallets found in database to monitor.",
        )

    webhook_payload = {
        "webhookURL": req.webhook_url,
        "transactionTypes": ["SWAP", "TRANSFER"],
        "accountAddresses": tracked_addresses,
        "webhookType": "enhanced",
    }
    if req.auth_header:
        webhook_payload["authHeader"] = req.auth_header

    helius_url = f"https://api.helius.xyz/v0/webhooks?api-key={api_key}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(helius_url, json=webhook_payload)
            if resp.status_code >= 400:
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Helius API error: {resp.text}",
                )
            return {
                "status": "success",
                "message": "Webhook registered successfully with Helius.",
                "helius_response": resp.json(),
            }
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Network error contacting Helius API: {str(e)}",
            )


@router.get("/helius/list")
async def list_helius_webhooks(_: None = Depends(verify_webhook_admin)):
    """Retrieve all webhooks currently registered on Helius for this API key."""
    api_key = os.getenv("HELIUS_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="HELIUS_API_KEY is not configured in .env",
        )

    helius_url = f"https://api.helius.xyz/v0/webhooks?api-key={api_key}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(helius_url)
            if resp.status_code >= 400:
                raise HTTPException(
                    status_code=resp.status_code,
                    detail=f"Helius API error: {resp.text}",
                )
            return resp.json()
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Network error contacting Helius API: {str(e)}",
            )
