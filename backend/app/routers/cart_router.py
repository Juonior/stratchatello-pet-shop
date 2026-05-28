from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from .. import schemas
from ..auth import get_current_user
from ..database import get_session

router = APIRouter(prefix="/api/cart", tags=["cart"])


def _build_cart(user_id: UUID) -> schemas.CartOut:
    s = get_session()
    items_rows = s.execute(
        "SELECT product_id, quantity FROM cart_items WHERE user_id=%s", (user_id,)
    ).all()
    items = []
    total = 0.0
    count = 0
    for ir in items_rows:
        prod = s.execute(
            "SELECT id, title, price, image, in_stock FROM products WHERE id=%s",
            (ir.product_id,)
        ).one()
        if not prod or not prod.in_stock:
            continue
        subtotal = float(prod.price) * ir.quantity
        items.append(schemas.CartItemOut(
            product_id=prod.id, title=prod.title, image=prod.image,
            price=float(prod.price), quantity=ir.quantity, subtotal=subtotal,
        ))
        total += subtotal
        count += ir.quantity
    items.sort(key=lambda x: x.title)
    return schemas.CartOut(items=items, total=total, count=count)


@router.get("", response_model=schemas.CartOut)
def get_cart(current=Depends(get_current_user)):
    return _build_cart(current["id"])


@router.post("/items", response_model=schemas.CartOut)
def add_to_cart(data: schemas.CartItemIn, current=Depends(get_current_user)):
    s = get_session()
    prod = s.execute("SELECT id FROM products WHERE id=%s", (data.product_id,)).one()
    if not prod:
        raise HTTPException(status_code=404, detail="Товар не найден")
    existing = s.execute(
        "SELECT quantity FROM cart_items WHERE user_id=%s AND product_id=%s",
        (current["id"], data.product_id)
    ).one()
    new_qty = (existing.quantity if existing else 0) + data.quantity
    s.execute(
        "INSERT INTO cart_items (user_id, product_id, quantity, added_at) VALUES (%s,%s,%s,%s)",
        (current["id"], data.product_id, new_qty, datetime.now(timezone.utc)),
    )
    return _build_cart(current["id"])


@router.put("/items/{product_id}", response_model=schemas.CartOut)
def update_item(product_id: UUID, data: schemas.CartItemIn, current=Depends(get_current_user)):
    s = get_session()
    if data.quantity <= 0:
        s.execute("DELETE FROM cart_items WHERE user_id=%s AND product_id=%s",
                  (current["id"], product_id))
    else:
        s.execute(
            "INSERT INTO cart_items (user_id, product_id, quantity, added_at) VALUES (%s,%s,%s,%s)",
            (current["id"], product_id, data.quantity, datetime.now(timezone.utc)),
        )
    return _build_cart(current["id"])


@router.delete("/items/{product_id}", response_model=schemas.CartOut)
def remove_item(product_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    s.execute("DELETE FROM cart_items WHERE user_id=%s AND product_id=%s",
              (current["id"], product_id))
    return _build_cart(current["id"])


@router.delete("", response_model=schemas.CartOut)
def clear_cart(current=Depends(get_current_user)):
    s = get_session()
    s.execute("DELETE FROM cart_items WHERE user_id=%s", (current["id"],))
    return _build_cart(current["id"])
