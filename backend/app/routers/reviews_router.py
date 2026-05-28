from datetime import datetime, timezone
from typing import List
from uuid import UUID
from cassandra.util import uuid_from_time
from fastapi import APIRouter, Depends, HTTPException
from .. import schemas
from ..auth import get_current_user
from ..database import get_session

router = APIRouter(prefix="/api/products/{product_id}/reviews", tags=["reviews"])


@router.get("", response_model=List[schemas.ReviewOut])
def list_reviews(product_id: UUID):
    s = get_session()
    rows = s.execute(
        "SELECT review_id, user_id, user_name, rating, text, created_at "
        "FROM reviews_by_product WHERE product_id=%s", (product_id,)
    ).all()
    return [
        schemas.ReviewOut(
            id=r.review_id, user_id=r.user_id, user_name=r.user_name,
            rating=r.rating, text=r.text, created_at=r.created_at,
        ) for r in rows
    ]


@router.post("", response_model=schemas.ReviewOut)
def add_review(product_id: UUID, data: schemas.ReviewIn, current=Depends(get_current_user)):
    s = get_session()
    product = s.execute("SELECT id, rating, rating_count FROM products WHERE id=%s", (product_id,)).one()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")
    now = datetime.now(timezone.utc)
    rid = uuid_from_time(now)
    s.execute(
        "INSERT INTO reviews_by_product (product_id, review_id, user_id, user_name, rating, text, created_at) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (product_id, rid, current["id"], current["name"], data.rating, data.text, now),
    )
    # Recompute rating
    rows = s.execute("SELECT rating FROM reviews_by_product WHERE product_id=%s", (product_id,)).all()
    ratings = [r.rating for r in rows]
    new_avg = sum(ratings) / len(ratings) if ratings else 0
    s.execute("UPDATE products SET rating=%s, rating_count=%s WHERE id=%s",
              (float(new_avg), len(ratings), product_id))
    return schemas.ReviewOut(
        id=rid, user_id=current["id"], user_name=current["name"],
        rating=data.rating, text=data.text, created_at=now,
    )
