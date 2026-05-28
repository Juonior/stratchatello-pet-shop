from datetime import datetime, timezone
from typing import List
from uuid import UUID
from cassandra.util import uuid_from_time
from fastapi import APIRouter, Depends, HTTPException
from .. import schemas
from ..auth import get_current_user
from ..database import get_session

router = APIRouter(tags=["posts"])


@router.post("/api/posts", response_model=schemas.PostOut)
def create_post(data: schemas.PostIn, current=Depends(get_current_user)):
    s = get_session()
    now = datetime.now(timezone.utc)
    pid = uuid_from_time(now)
    me = s.execute("SELECT name, photo FROM users WHERE id=%s", (current["id"],)).one()
    s.execute(
        "INSERT INTO posts (id, user_id, user_name, user_photo, text, image, created_at) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (pid, current["id"], me.name, me.photo, data.text, data.image, now),
    )
    s.execute(
        "INSERT INTO posts_by_user (user_id, post_id, text, image, created_at) "
        "VALUES (%s,%s,%s,%s,%s)",
        (current["id"], pid, data.text, data.image, now),
    )
    return schemas.PostOut(
        id=pid, user_id=current["id"], user_name=me.name, user_photo=me.photo,
        text=data.text, image=data.image, created_at=now,
    )


@router.get("/api/posts/{post_id}", response_model=schemas.PostOut)
def get_post(post_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    r = s.execute(
        "SELECT id, user_id, user_name, user_photo, text, image, created_at FROM posts WHERE id=%s",
        (post_id,)
    ).one()
    if not r:
        raise HTTPException(status_code=404, detail="Пост не найден")
    return schemas.PostOut(
        id=r.id, user_id=r.user_id, user_name=r.user_name, user_photo=r.user_photo,
        text=r.text, image=r.image, created_at=r.created_at,
    )


@router.delete("/api/posts/{post_id}")
def delete_post(post_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    r = s.execute("SELECT id, user_id FROM posts WHERE id=%s", (post_id,)).one()
    if not r:
        raise HTTPException(status_code=404, detail="Пост не найден")
    if r.user_id != current["id"]:
        raise HTTPException(status_code=403, detail="Можно удалять только свои посты")
    s.execute("DELETE FROM posts WHERE id=%s", (post_id,))
    s.execute("DELETE FROM posts_by_user WHERE user_id=%s AND post_id=%s", (current["id"], post_id))
    return {"status": "deleted"}


@router.get("/api/users/{user_id}/posts", response_model=List[schemas.PostOut])
def list_user_posts(user_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    user = s.execute("SELECT id, name, photo FROM users WHERE id=%s", (user_id,)).one()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    rows = s.execute(
        "SELECT post_id, text, image, created_at FROM posts_by_user WHERE user_id=%s LIMIT 100",
        (user_id,)
    ).all()
    return [
        schemas.PostOut(
            id=r.post_id, user_id=user.id, user_name=user.name, user_photo=user.photo,
            text=r.text, image=r.image, created_at=r.created_at,
        ) for r in rows
    ]
