from datetime import datetime, timezone
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from .. import schemas
from ..auth import get_current_user
from ..database import get_session

router = APIRouter(tags=["likes"])


def count_likes(s, post_id: UUID) -> int:
    r = s.execute(
        "SELECT COUNT(*) AS c FROM post_likes WHERE post_id=%s", (post_id,)
    ).one()
    return int(r.c) if r else 0


def my_liked_post_ids(s, user_id: UUID) -> set[UUID]:
    rows = s.execute(
        "SELECT post_id FROM post_likes_by_user WHERE user_id=%s", (user_id,)
    ).all()
    return {r.post_id for r in rows}


@router.post("/api/posts/{post_id}/like", response_model=schemas.LikeStateOut)
def like(post_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    if not s.execute("SELECT id FROM posts WHERE id=%s", (post_id,)).one():
        raise HTTPException(status_code=404, detail="Пост не найден")
    now = datetime.now(timezone.utc)
    # Both inserts are idempotent — overwriting a row with same key has no side-effects
    s.execute(
        "INSERT INTO post_likes (post_id, user_id, liked_at) VALUES (%s,%s,%s)",
        (post_id, current["id"], now),
    )
    s.execute(
        "INSERT INTO post_likes_by_user (user_id, post_id, liked_at) VALUES (%s,%s,%s)",
        (current["id"], post_id, now),
    )
    return schemas.LikeStateOut(liked_by_me=True, likes_count=count_likes(s, post_id))


@router.delete("/api/posts/{post_id}/like", response_model=schemas.LikeStateOut)
def unlike(post_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    s.execute(
        "DELETE FROM post_likes WHERE post_id=%s AND user_id=%s",
        (post_id, current["id"]),
    )
    s.execute(
        "DELETE FROM post_likes_by_user WHERE user_id=%s AND post_id=%s",
        (current["id"], post_id),
    )
    return schemas.LikeStateOut(liked_by_me=False, likes_count=count_likes(s, post_id))
