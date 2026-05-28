from datetime import datetime, timezone
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from .. import schemas
from ..auth import get_current_user
from ..database import get_session

router = APIRouter(prefix="/api/friends", tags=["friends"])


def _fetch_user(s, user_id: UUID):
    return s.execute("SELECT id, email, name, photo FROM users WHERE id=%s", (user_id,)).one()


def _add_friendship(s, a_id: UUID, a_name: str, a_photo, a_email,
                    b_id: UUID, b_name: str, b_photo, b_email):
    now = datetime.now(timezone.utc)
    s.execute(
        "INSERT INTO friendships (user_id, friend_id, friend_name, friend_photo, friend_email, since) "
        "VALUES (%s,%s,%s,%s,%s,%s)",
        (a_id, b_id, b_name, b_photo, b_email, now),
    )
    s.execute(
        "INSERT INTO friendships (user_id, friend_id, friend_name, friend_photo, friend_email, since) "
        "VALUES (%s,%s,%s,%s,%s,%s)",
        (b_id, a_id, a_name, a_photo, a_email, now),
    )


def _drop_requests(s, a: UUID, b: UUID):
    s.execute("DELETE FROM friend_requests_outgoing WHERE user_id=%s AND to_user_id=%s", (a, b))
    s.execute("DELETE FROM friend_requests_outgoing WHERE user_id=%s AND to_user_id=%s", (b, a))
    s.execute("DELETE FROM friend_requests_incoming WHERE user_id=%s AND from_user_id=%s", (a, b))
    s.execute("DELETE FROM friend_requests_incoming WHERE user_id=%s AND from_user_id=%s", (b, a))


@router.get("", response_model=List[schemas.FriendOut])
def list_friends(current=Depends(get_current_user)):
    s = get_session()
    rows = s.execute(
        "SELECT friend_id, friend_name, friend_photo, friend_email, since FROM friendships WHERE user_id=%s",
        (current["id"],)
    ).all()
    out = [
        schemas.FriendOut(
            id=r.friend_id, name=r.friend_name, email=r.friend_email,
            photo=r.friend_photo, since=r.since,
        ) for r in rows
    ]
    out.sort(key=lambda x: x.name.lower())
    return out


@router.get("/requests/incoming", response_model=List[schemas.FriendRequestOut])
def incoming(current=Depends(get_current_user)):
    s = get_session()
    rows = s.execute(
        "SELECT from_user_id, from_user_name, from_user_photo, created_at "
        "FROM friend_requests_incoming WHERE user_id=%s",
        (current["id"],)
    ).all()
    return [
        schemas.FriendRequestOut(
            user_id=r.from_user_id, name=r.from_user_name,
            photo=r.from_user_photo, created_at=r.created_at,
        ) for r in rows
    ]


@router.get("/requests/outgoing", response_model=List[schemas.FriendRequestOut])
def outgoing(current=Depends(get_current_user)):
    s = get_session()
    rows = s.execute(
        "SELECT to_user_id, to_user_name, to_user_photo, created_at "
        "FROM friend_requests_outgoing WHERE user_id=%s",
        (current["id"],)
    ).all()
    return [
        schemas.FriendRequestOut(
            user_id=r.to_user_id, name=r.to_user_name,
            photo=r.to_user_photo, created_at=r.created_at,
        ) for r in rows
    ]


@router.post("/request/{user_id}")
def send_request(user_id: UUID, current=Depends(get_current_user)):
    if user_id == current["id"]:
        raise HTTPException(status_code=400, detail="Нельзя дружить с самим собой")
    s = get_session()
    target = _fetch_user(s, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Already friends?
    if s.execute("SELECT friend_id FROM friendships WHERE user_id=%s AND friend_id=%s",
                 (current["id"], user_id)).one():
        return {"status": "already_friends"}

    # Has the other side already sent us a request? → auto-accept.
    incoming_row = s.execute(
        "SELECT from_user_id FROM friend_requests_incoming WHERE user_id=%s AND from_user_id=%s",
        (current["id"], user_id)
    ).one()
    if incoming_row:
        me = s.execute("SELECT name, photo, email FROM users WHERE id=%s", (current["id"],)).one()
        _add_friendship(s,
                        current["id"], me.name, me.photo, me.email,
                        target.id, target.name, target.photo, target.email)
        _drop_requests(s, current["id"], user_id)
        return {"status": "accepted"}

    # Otherwise create the pending request
    now = datetime.now(timezone.utc)
    me = s.execute("SELECT name, photo FROM users WHERE id=%s", (current["id"],)).one()
    s.execute(
        "INSERT INTO friend_requests_outgoing (user_id, to_user_id, to_user_name, to_user_photo, created_at) "
        "VALUES (%s,%s,%s,%s,%s)",
        (current["id"], user_id, target.name, target.photo, now),
    )
    s.execute(
        "INSERT INTO friend_requests_incoming (user_id, from_user_id, from_user_name, from_user_photo, created_at) "
        "VALUES (%s,%s,%s,%s,%s)",
        (user_id, current["id"], me.name, me.photo, now),
    )
    return {"status": "sent"}


@router.post("/accept/{user_id}")
def accept(user_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    incoming_row = s.execute(
        "SELECT from_user_id FROM friend_requests_incoming WHERE user_id=%s AND from_user_id=%s",
        (current["id"], user_id)
    ).one()
    if not incoming_row:
        raise HTTPException(status_code=404, detail="Запрос не найден")
    me = s.execute("SELECT name, photo, email FROM users WHERE id=%s", (current["id"],)).one()
    other = _fetch_user(s, user_id)
    if not other:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    _add_friendship(s,
                    current["id"], me.name, me.photo, me.email,
                    other.id, other.name, other.photo, other.email)
    _drop_requests(s, current["id"], user_id)
    return {"status": "accepted"}


@router.post("/reject/{user_id}")
def reject(user_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    _drop_requests(s, current["id"], user_id)
    return {"status": "rejected"}


@router.delete("/{user_id}")
def remove(user_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    s.execute("DELETE FROM friendships WHERE user_id=%s AND friend_id=%s", (current["id"], user_id))
    s.execute("DELETE FROM friendships WHERE user_id=%s AND friend_id=%s", (user_id, current["id"]))
    return {"status": "removed"}
