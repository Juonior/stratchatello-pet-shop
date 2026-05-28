from datetime import datetime, timezone
from typing import List
from uuid import UUID
from cassandra.util import uuid_from_time
from fastapi import APIRouter, Depends, HTTPException
from .. import schemas
from ..auth import get_current_user
from ..database import get_session

router = APIRouter(prefix="/api/messages", tags=["messages"])


def _thread_key(a: UUID, b: UUID) -> str:
    """Deterministic key for any pair of users."""
    return "|".join(sorted([str(a), str(b)]))


@router.get("/threads", response_model=List[schemas.ThreadOut])
def list_threads(current=Depends(get_current_user)):
    s = get_session()
    rows = s.execute(
        "SELECT peer_id, peer_name, peer_photo, last_message_text, last_message_at, last_from_me "
        "FROM dm_threads_by_user WHERE user_id=%s",
        (current["id"],)
    ).all()
    out = [
        schemas.ThreadOut(
            peer_id=r.peer_id, peer_name=r.peer_name, peer_photo=r.peer_photo,
            last_message_text=r.last_message_text,
            last_message_at=r.last_message_at,
            last_from_me=bool(r.last_from_me),
        ) for r in rows
    ]
    out.sort(key=lambda x: x.last_message_at or datetime.min.replace(tzinfo=timezone.utc),
             reverse=True)
    return out


@router.get("/{peer_id}", response_model=List[schemas.MessageOut])
def list_messages(peer_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    tk = _thread_key(current["id"], peer_id)
    rows = s.execute(
        "SELECT msg_id, from_user_id, text, created_at FROM dm_messages WHERE thread_key=%s LIMIT 500",
        (tk,)
    ).all()
    return [
        schemas.MessageOut(
            id=r.msg_id, from_user_id=r.from_user_id, text=r.text,
            created_at=r.created_at, mine=(r.from_user_id == current["id"]),
        ) for r in rows
    ]


@router.post("/{peer_id}", response_model=schemas.MessageOut)
def send_message(peer_id: UUID, data: schemas.MessageIn, current=Depends(get_current_user)):
    s = get_session()
    if peer_id == current["id"]:
        raise HTTPException(status_code=400, detail="Нельзя писать самому себе")
    me = s.execute("SELECT name, photo FROM users WHERE id=%s", (current["id"],)).one()
    peer = s.execute("SELECT id, name, photo FROM users WHERE id=%s", (peer_id,)).one()
    if not peer:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    now = datetime.now(timezone.utc)
    mid = uuid_from_time(now)
    tk = _thread_key(current["id"], peer_id)

    s.execute(
        "INSERT INTO dm_messages (thread_key, msg_id, from_user_id, text, created_at) "
        "VALUES (%s,%s,%s,%s,%s)",
        (tk, mid, current["id"], data.text, now),
    )

    # Update both thread summaries
    s.execute(
        "INSERT INTO dm_threads_by_user (user_id, peer_id, peer_name, peer_photo, "
        "last_message_text, last_message_at, last_from_me) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (current["id"], peer.id, peer.name, peer.photo, data.text, now, True),
    )
    s.execute(
        "INSERT INTO dm_threads_by_user (user_id, peer_id, peer_name, peer_photo, "
        "last_message_text, last_message_at, last_from_me) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (peer.id, current["id"], me.name, me.photo, data.text, now, False),
    )

    return schemas.MessageOut(
        id=mid, from_user_id=current["id"], text=data.text,
        created_at=now, mine=True,
    )
