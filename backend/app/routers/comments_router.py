from datetime import datetime, timezone
from typing import List
from uuid import UUID
from cassandra.util import uuid_from_time
from fastapi import APIRouter, Depends, HTTPException
from .. import schemas
from ..auth import get_current_user
from ..database import get_session

router = APIRouter(tags=["comments"])


@router.get("/api/posts/{post_id}/comments", response_model=List[schemas.CommentOut])
def list_comments(post_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    rows = s.execute(
        "SELECT comment_id, user_id, user_name, user_photo, text, created_at "
        "FROM post_comments WHERE post_id=%s",
        (post_id,)
    ).all()
    return [
        schemas.CommentOut(
            id=r.comment_id, user_id=r.user_id, user_name=r.user_name,
            user_photo=r.user_photo, text=r.text, created_at=r.created_at,
        ) for r in rows
    ]


@router.post("/api/posts/{post_id}/comments", response_model=schemas.CommentOut)
def add_comment(post_id: UUID, data: schemas.CommentIn, current=Depends(get_current_user)):
    s = get_session()
    post = s.execute("SELECT id FROM posts WHERE id=%s", (post_id,)).one()
    if not post:
        raise HTTPException(status_code=404, detail="Пост не найден")
    me = s.execute("SELECT name, photo FROM users WHERE id=%s", (current["id"],)).one()
    now = datetime.now(timezone.utc)
    cid = uuid_from_time(now)
    s.execute(
        "INSERT INTO post_comments (post_id, comment_id, user_id, user_name, user_photo, text, created_at) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (post_id, cid, current["id"], me.name, me.photo, data.text, now),
    )
    return schemas.CommentOut(
        id=cid, user_id=current["id"], user_name=me.name, user_photo=me.photo,
        text=data.text, created_at=now,
    )


@router.delete("/api/posts/{post_id}/comments/{comment_id}")
def delete_comment(post_id: UUID, comment_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    r = s.execute(
        "SELECT user_id FROM post_comments WHERE post_id=%s AND comment_id=%s",
        (post_id, comment_id)
    ).one()
    if not r:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    if r.user_id != current["id"]:
        # Optionally: also let post author delete comments on their post
        post = s.execute("SELECT user_id FROM posts WHERE id=%s", (post_id,)).one()
        if not post or post.user_id != current["id"]:
            raise HTTPException(status_code=403, detail="Нельзя удалять чужие комментарии")
    s.execute(
        "DELETE FROM post_comments WHERE post_id=%s AND comment_id=%s",
        (post_id, comment_id)
    )
    return {"status": "deleted"}
