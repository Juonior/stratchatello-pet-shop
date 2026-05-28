from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, Query
from .. import schemas
from ..database import get_session

router = APIRouter(prefix="/api", tags=["catalog"])


def _row_to_product(row) -> schemas.ProductOut:
    return schemas.ProductOut(
        id=row.id,
        category_id=row.category_id,
        title=row.title,
        brand=row.brand,
        price=row.price,
        old_price=row.old_price,
        rating=row.rating or 0,
        rating_count=row.rating_count or 0,
        image=row.image,
        in_stock=bool(row.in_stock),
        size_for=row.size_for,
        tags=list(row.tags or []),
        description=row.description,
        composition=row.composition,
        instruction=row.instruction,
    )


def _row_to_card(row) -> schemas.ProductCardOut:
    return schemas.ProductCardOut(
        id=row.id,
        category_id=row.category_id,
        title=row.title,
        brand=row.brand,
        price=row.price,
        old_price=row.old_price,
        rating=row.rating or 0,
        rating_count=row.rating_count or 0,
        image=row.image,
        in_stock=bool(row.in_stock),
        size_for=row.size_for,
        tags=list(row.tags or []),
    )


@router.get("/categories", response_model=List[schemas.CategoryOut])
def list_categories():
    s = get_session()
    rows = s.execute(
        "SELECT id, slug, title, description, icon, sort_order, cover_image FROM categories"
    ).all()
    cats = [
        schemas.CategoryOut(
            id=r.id, slug=r.slug, title=r.title, description=r.description,
            icon=r.icon, sort_order=r.sort_order or 0,
            cover_image=getattr(r, "cover_image", None),
        ) for r in rows
    ]
    cats.sort(key=lambda c: (c.sort_order, c.title))
    return cats


@router.get("/products", response_model=List[schemas.ProductCardOut])
def list_products(
    category: Optional[str] = Query(default=None, description="Slug категории"),
    q: Optional[str] = Query(default=None),
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    brand: Optional[str] = None,
    min_rating: Optional[float] = None,
    sort: str = Query(default="popular", pattern="^(popular|price_asc|price_desc|rating)$"),
    limit: int = Query(default=60, ge=1, le=200),
):
    s = get_session()
    rows = s.execute(
        "SELECT id, category_id, title, brand, price, old_price, rating, rating_count, "
        "description, composition, instruction, image, tags, size_for, in_stock, created_at "
        "FROM products"
    ).all()
    items = [_row_to_card(r) for r in rows]

    if category:
        cat_row = next((c for c in list_categories() if c.slug == category), None)
        if not cat_row:
            return []
        items = [i for i in items if i.category_id == cat_row.id]
    if q:
        ql = q.lower()
        items = [i for i in items if ql in (i.title or "").lower() or ql in (i.brand or "").lower()]
    if min_price is not None:
        items = [i for i in items if i.price >= min_price]
    if max_price is not None:
        items = [i for i in items if i.price <= max_price]
    if brand:
        items = [i for i in items if (i.brand or "").lower() == brand.lower()]
    if min_rating is not None:
        items = [i for i in items if (i.rating or 0) >= min_rating]

    if sort == "price_asc":
        items.sort(key=lambda x: x.price)
    elif sort == "price_desc":
        items.sort(key=lambda x: -x.price)
    elif sort == "rating":
        items.sort(key=lambda x: (-(x.rating or 0), -(x.rating_count or 0)))
    else:  # popular
        items.sort(key=lambda x: -(x.rating_count or 0))

    return items[:limit]


@router.get("/products/brands", response_model=List[str])
def list_brands():
    s = get_session()
    rows = s.execute("SELECT brand FROM products").all()
    brands = sorted({(r.brand or "").strip() for r in rows if r.brand})
    return brands


@router.get("/products/{product_id}", response_model=schemas.ProductOut)
def get_product(product_id: UUID):
    s = get_session()
    row = s.execute(
        "SELECT id, category_id, title, brand, price, old_price, rating, rating_count, "
        "description, composition, instruction, image, tags, size_for, in_stock, created_at "
        "FROM products WHERE id=%s", (product_id,)
    ).one()
    if not row:
        raise HTTPException(status_code=404, detail="Товар не найден")
    return _row_to_product(row)
