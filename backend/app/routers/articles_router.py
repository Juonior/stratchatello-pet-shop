from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, Query
from .. import schemas
from ..database import get_session

router = APIRouter(prefix="/api/articles", tags=["articles"])


def _row_to_card(r) -> schemas.ArticleCardOut:
    return schemas.ArticleCardOut(
        id=r.id, slug=r.slug, title=r.title, annotation=r.annotation,
        topic=r.topic, image=r.image, author=r.author, published_at=r.published_at,
    )


@router.get("", response_model=List[schemas.ArticleCardOut])
def list_articles(
    q: Optional[str] = Query(default=None),
    topic: Optional[str] = Query(default=None),
):
    s = get_session()
    rows = s.execute(
        "SELECT id, slug, title, annotation, topic, image, author, published_at, body FROM articles"
    ).all()
    items = list(rows)
    if topic:
        items = [r for r in items if (r.topic or "").lower() == topic.lower()]
    if q:
        ql = q.lower()
        items = [r for r in items
                 if ql in (r.title or "").lower()
                 or ql in (r.body or "").lower()
                 or ql in (r.annotation or "").lower()]
    items.sort(key=lambda r: r.published_at or 0, reverse=True)
    return [_row_to_card(r) for r in items]


@router.get("/topics", response_model=List[str])
def list_topics():
    s = get_session()
    rows = s.execute("SELECT topic FROM articles").all()
    return sorted({(r.topic or "") for r in rows if r.topic})


@router.get("/{article_id}", response_model=schemas.ArticleOut)
def get_article(article_id: UUID):
    s = get_session()
    row = s.execute(
        "SELECT id, slug, title, annotation, body, topic, image, author, published_at "
        "FROM articles WHERE id=%s", (article_id,)
    ).one()
    if not row:
        raise HTTPException(status_code=404, detail="Статья не найдена")
    return schemas.ArticleOut(
        id=row.id, slug=row.slug, title=row.title, annotation=row.annotation,
        body=row.body, topic=row.topic, image=row.image, author=row.author,
        published_at=row.published_at,
    )
