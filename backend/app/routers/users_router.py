from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from .. import schemas
from ..auth import get_current_user
from ..database import get_session

router = APIRouter(prefix="/api/users", tags=["users"])


def _user_relation(s, my_id: UUID, other_id: UUID) -> str:
    if my_id == other_id:
        return "self"
    f = s.execute(
        "SELECT friend_id FROM friendships WHERE user_id=%s AND friend_id=%s",
        (my_id, other_id)
    ).one()
    if f:
        return "friend"
    sent = s.execute(
        "SELECT to_user_id FROM friend_requests_outgoing WHERE user_id=%s AND to_user_id=%s",
        (my_id, other_id)
    ).one()
    if sent:
        return "request_sent"
    recv = s.execute(
        "SELECT from_user_id FROM friend_requests_incoming WHERE user_id=%s AND from_user_id=%s",
        (my_id, other_id)
    ).one()
    if recv:
        return "request_received"
    return "stranger"


@router.get("/search", response_model=List[schemas.PublicUser])
def search_users(
    q: Optional[str] = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
    current=Depends(get_current_user),
):
    """Naive search: filter all users in app code. Fine for demo scale."""
    s = get_session()
    rows = s.execute("SELECT id, email, name, photo FROM users").all()
    ql = (q or "").strip().lower()
    out = []
    for r in rows:
        if r.id == current["id"]:
            continue
        if ql:
            hay = f"{r.name or ''} {r.email or ''}".lower()
            if ql not in hay:
                continue
        rel = _user_relation(s, current["id"], r.id)
        out.append(schemas.PublicUser(
            id=r.id, name=r.name, email=r.email, photo=r.photo, relation=rel,
        ))
    out.sort(key=lambda u: (0 if u.relation == "friend" else 1, u.name.lower()))
    return out[:limit]


@router.get("/{user_id}", response_model=schemas.PublicUser)
def get_user(user_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    r = s.execute("SELECT id, email, name, photo FROM users WHERE id=%s", (user_id,)).one()
    if not r:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return schemas.PublicUser(
        id=r.id, name=r.name, email=r.email, photo=r.photo,
        relation=_user_relation(s, current["id"], r.id),
    )
