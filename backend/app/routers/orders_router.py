import json
from datetime import datetime, timezone
from typing import List
from uuid import UUID
from cassandra.util import uuid_from_time
from fastapi import APIRouter, Depends, HTTPException
from .. import schemas
from ..auth import get_current_user
from ..database import get_session
from ..config import settings
from .cart_router import _build_cart

router = APIRouter(prefix="/api/orders", tags=["orders"])


def _row_to_order(row) -> schemas.OrderOut:
    items_raw = json.loads(row.items_json or "[]")
    items = [schemas.OrderItemSnap(**i) for i in items_raw]
    return schemas.OrderOut(
        id=row.order_id, total=float(row.total), status=row.status,
        address=row.address, delivery_time=row.delivery_time,
        payment_method=row.payment_method, items=items, created_at=row.created_at,
    )


@router.get("", response_model=List[schemas.OrderOut])
def my_orders(current=Depends(get_current_user)):
    s = get_session()
    rows = s.execute(
        "SELECT order_id, total, status, address, delivery_time, payment_method, "
        "items_json, created_at FROM orders_by_user WHERE user_id=%s",
        (current["id"],)
    ).all()
    return [_row_to_order(r) for r in rows]


@router.post("/checkout", response_model=schemas.OrderOut)
def checkout(data: schemas.CheckoutIn, current=Depends(get_current_user)):
    s = get_session()
    cart = _build_cart(current["id"])
    if not cart.items:
        raise HTTPException(status_code=400, detail="Корзина пуста")

    now = datetime.now(timezone.utc)
    oid = uuid_from_time(now)
    items_snap = [
        {
            "product_id": str(i.product_id),
            "title": i.title,
            "price": i.price,
            "quantity": i.quantity,
            "image": i.image,
        }
        for i in cart.items
    ]

    # ---- Mock payment: auto-approve ----
    payment_status = "paid" if settings.payment_autoapprove else "pending"
    status_text = "paid" if payment_status == "paid" else "awaiting_payment"

    s.execute(
        "INSERT INTO orders_by_user (user_id, order_id, total, status, address, "
        "delivery_time, payment_method, items_json, created_at) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (current["id"], oid, float(cart.total), status_text, data.address,
         data.delivery_time, data.payment_method, json.dumps(items_snap), now),
    )
    # Clear cart
    s.execute("DELETE FROM cart_items WHERE user_id=%s", (current["id"],))

    return schemas.OrderOut(
        id=oid, total=float(cart.total), status=status_text,
        address=data.address, delivery_time=data.delivery_time,
        payment_method=data.payment_method,
        items=[schemas.OrderItemSnap(
            product_id=UUID(i["product_id"]),
            title=i["title"], price=i["price"], quantity=i["quantity"], image=i["image"],
        ) for i in items_snap],
        created_at=now,
    )
