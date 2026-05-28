"""Mock payment provider. Always returns success — no real gateway is called."""
from datetime import datetime, timezone
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..auth import get_current_user
from ..config import settings

router = APIRouter(prefix="/api/payments", tags=["payments"])


class PaymentIn(BaseModel):
    order_id: UUID
    amount: float


class PaymentOut(BaseModel):
    payment_id: UUID
    order_id: UUID
    amount: float
    status: str
    provider: str
    processed_at: datetime
    receipt: str


@router.post("", response_model=PaymentOut)
def create_payment(data: PaymentIn, current=Depends(get_current_user)):
    return PaymentOut(
        payment_id=uuid4(),
        order_id=data.order_id,
        amount=data.amount,
        status="succeeded" if settings.payment_autoapprove else "pending",
        provider=settings.payment_provider,
        processed_at=datetime.now(timezone.utc),
        receipt=f"MOCK-{uuid4().hex[:12].upper()}",
    )
