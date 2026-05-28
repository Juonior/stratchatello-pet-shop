from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends
from .. import schemas
from ..auth import get_current_user
from ..database import get_session

router = APIRouter(prefix="/api/feed", tags=["feed"])


def _row_to_post(r) -> schemas.PostOut:
    return schemas.PostOut(
        id=r.id, user_id=r.user_id, user_name=r.user_name, user_photo=r.user_photo,
        text=r.text, image=r.image, created_at=r.created_at,
    )


@router.get("", response_model=List[schemas.FeedItem])
def feed(current=Depends(get_current_user)):
    s = get_session()
    # 1. Get my friends
    friend_rows = s.execute(
        "SELECT friend_id FROM friendships WHERE user_id=%s", (current["id"],)
    ).all()
    friend_ids = {r.friend_id for r in friend_rows}

    # 2. All posts (small demo scale) — fetch and partition
    all_rows = s.execute(
        "SELECT id, user_id, user_name, user_photo, text, image, created_at FROM posts"
    ).all()
    friends_posts = []
    discover_posts = []
    for r in all_rows:
        if r.user_id == current["id"]:
            continue  # don't show own posts in feed
        if r.user_id in friend_ids:
            friends_posts.append(r)
        else:
            discover_posts.append(r)

    friends_posts.sort(key=lambda x: x.created_at, reverse=True)
    discover_posts.sort(key=lambda x: x.created_at, reverse=True)

    items: List[schemas.FeedItem] = []
    for r in friends_posts[:50]:
        items.append(schemas.FeedItem(post=_row_to_post(r), section="friends"))
    # Top recent posts from strangers as "discover"
    for r in discover_posts[:10]:
        items.append(schemas.FeedItem(post=_row_to_post(r), section="discover"))
    return items
