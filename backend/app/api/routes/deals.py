"""Deal endpoints — powers the KPI bar and the Deal Detail page."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.schemas.deal import DealDetail, DealListResponse, KPIStats
from app.services import deal_service

router = APIRouter()


@router.get("", response_model=DealListResponse)
async def list_deals(user: dict = Depends(get_current_user)) -> DealListResponse:
    return await deal_service.list_deals(user["id"])


@router.get("/kpis", response_model=KPIStats)
async def kpis(user: dict = Depends(get_current_user)) -> KPIStats:
    return await deal_service.get_kpis(user["id"])


@router.get("/{deal_id}", response_model=DealDetail)
async def get_deal(deal_id: str, user: dict = Depends(get_current_user)) -> DealDetail:
    deal = await deal_service.get_deal(user["id"], deal_id)
    if deal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="deal not found")
    return deal


@router.get("/{deal_id}/screener")
async def download_screener(
    deal_id: str,
    user: dict = Depends(get_current_user),
) -> dict:
    """Return a 1-hour pre-signed S3 URL for downloading the screener Excel."""
    deal = await deal_service.get_deal(user["id"], deal_id)
    if deal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="deal not found")
    if not deal.screener_s3_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="screener not yet generated for this deal",
        )
    from app.agents.demo import get_screener_presigned_url
    url = await get_screener_presigned_url(deal.screener_s3_key)
    return {"url": url}


@router.post("/{deal_id}/send-email")
async def send_screening_email(
    deal_id: str,
    user: dict = Depends(get_current_user),
) -> dict:
    # TODO: compose MIME message and send via Gmail API with screener attached
    _ = (deal_id, user)
    return {"status": "queued"}
