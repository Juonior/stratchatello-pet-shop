from typing import List, Optional
from fastapi import APIRouter, Depends
from .. import schemas
from ..auth import get_current_user_optional
from ..database import get_session
from .catalog import _row_to_card

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])

SIZE_RU = {"small": "маленький", "medium": "средний", "large": "крупный"}


def _plural_years(n: int) -> str:
    n = abs(int(n))
    if 11 <= (n % 100) <= 14:
        return "лет"
    last = n % 10
    if last == 1:
        return "год"
    if 2 <= last <= 4:
        return "года"
    return "лет"


def _all_products():
    s = get_session()
    return s.execute(
        "SELECT id, category_id, title, brand, price, old_price, rating, rating_count, "
        "description, composition, instruction, image, tags, size_for, in_stock, created_at "
        "FROM products"
    ).all()


@router.get("", response_model=List[schemas.RecommendationsOut])
def recommendations(current: Optional[dict] = Depends(get_current_user_optional)):
    s = get_session()
    products = _all_products()
    blocks: List[schemas.RecommendationsOut] = []

    if current:
        pets = s.execute(
            "SELECT name, breed, age, size, allergies FROM pets_by_user WHERE user_id=%s",
            (current["id"],)
        ).all()
        for pet in pets[:3]:
            size = (pet.size or "medium").lower()
            allergies = (pet.allergies or "").lower()
            matched = []
            for p in products:
                if (p.size_for or "any") not in (size, "any"):
                    continue
                if "куриц" in allergies and "куриц" in (p.composition or "").lower():
                    continue
                if "лосос" in allergies and "лосос" in (p.composition or "").lower():
                    continue
                matched.append(_row_to_card(p))
            matched.sort(key=lambda x: (-(x.rating or 0), -(x.rating_count or 0)))
            size_ru = SIZE_RU.get(size, size)
            years_ru = _plural_years(pet.age or 0)
            reason_parts = [pet.breed, f"{pet.age} {years_ru}", f"размер: {size_ru}"]
            if allergies:
                reason_parts.append(f"аллергии: {allergies}")
            blocks.append(schemas.RecommendationsOut(
                title=f"Подборка для {pet.name}",
                reason=" · ".join(reason_parts),
                products=matched[:8],
            ))

    # Always: hits
    by_rating = sorted([_row_to_card(p) for p in products],
                        key=lambda x: (-(x.rating or 0), -(x.rating_count or 0)))
    blocks.append(schemas.RecommendationsOut(
        title="Хиты продаж",
        reason="Самые популярные товары по отзывам покупателей",
        products=by_rating[:8],
    ))

    # Always: deals
    deals = [_row_to_card(p) for p in products if p.old_price and p.old_price > p.price]
    deals.sort(key=lambda x: -((x.old_price or 0) - x.price))
    if deals:
        blocks.append(schemas.RecommendationsOut(
            title="Скидки и акции",
            reason="Товары, на которые сейчас действует скидка",
            products=deals[:8],
        ))

    return blocks
