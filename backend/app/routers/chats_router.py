from datetime import datetime, timezone
from typing import List
from uuid import UUID, uuid4
from cassandra.util import uuid_from_time
from fastapi import APIRouter, Depends, HTTPException
from .. import schemas
from ..auth import get_current_user
from ..database import get_session

router = APIRouter(prefix="/api/chats", tags=["chats"])


def _is_member(s, room_id: UUID, user_id: UUID) -> bool:
    r = s.execute(
        "SELECT user_id FROM chat_room_members WHERE room_id=%s AND user_id=%s",
        (room_id, user_id)
    ).one()
    return r is not None


def _list_members(s, room_id: UUID) -> List[schemas.ChatMemberOut]:
    rows = s.execute(
        "SELECT user_id, name, photo FROM chat_room_members WHERE room_id=%s",
        (room_id,)
    ).all()
    return [
        schemas.ChatMemberOut(id=r.user_id, name=r.name, photo=r.photo)
        for r in rows
    ]


def _add_member_to_room(s, room_id: UUID, room_title: str, room_photo, user_id: UUID, user_name: str, user_photo):
    now = datetime.now(timezone.utc)
    s.execute(
        "INSERT INTO chat_room_members (room_id, user_id, name, photo, joined_at) "
        "VALUES (%s,%s,%s,%s,%s)",
        (room_id, user_id, user_name, user_photo, now),
    )
    s.execute(
        "INSERT INTO chat_rooms_by_user (user_id, room_id, title, photo, "
        "last_message_text, last_message_at, last_from_name) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (user_id, room_id, room_title, room_photo, None, None, None),
    )


@router.get("", response_model=List[schemas.ChatThreadOut])
def list_my_chats(current=Depends(get_current_user)):
    s = get_session()
    rows = s.execute(
        "SELECT room_id, title, photo, last_message_text, last_message_at, last_from_name "
        "FROM chat_rooms_by_user WHERE user_id=%s",
        (current["id"],)
    ).all()
    out = [
        schemas.ChatThreadOut(
            room_id=r.room_id, title=r.title, photo=r.photo,
            last_message_text=r.last_message_text,
            last_message_at=r.last_message_at,
            last_from_name=r.last_from_name,
        ) for r in rows
    ]
    out.sort(
        key=lambda x: x.last_message_at or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    return out


@router.post("", response_model=schemas.ChatRoomOut)
def create_chat(data: schemas.ChatRoomIn, current=Depends(get_current_user)):
    s = get_session()
    me = s.execute("SELECT name, photo FROM users WHERE id=%s", (current["id"],)).one()
    rid = uuid4()
    now = datetime.now(timezone.utc)
    s.execute(
        "INSERT INTO chat_rooms (id, title, photo, created_by, created_at) "
        "VALUES (%s,%s,%s,%s,%s)",
        (rid, data.title, data.photo, current["id"], now),
    )
    # Add creator
    _add_member_to_room(s, rid, data.title, data.photo, current["id"], me.name, me.photo)
    # Add initial members
    seen = {current["id"]}
    for uid in data.member_ids:
        if uid in seen:
            continue
        seen.add(uid)
        u = s.execute("SELECT name, photo FROM users WHERE id=%s", (uid,)).one()
        if not u:
            continue
        _add_member_to_room(s, rid, data.title, data.photo, uid, u.name, u.photo)
    return schemas.ChatRoomOut(
        id=rid, title=data.title, photo=data.photo,
        created_by=current["id"], created_at=now,
        members=_list_members(s, rid),
    )


@router.get("/{room_id}", response_model=schemas.ChatRoomOut)
def get_chat(room_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    if not _is_member(s, room_id, current["id"]):
        raise HTTPException(status_code=403, detail="Вы не участник этой беседы")
    r = s.execute(
        "SELECT id, title, photo, created_by, created_at FROM chat_rooms WHERE id=%s",
        (room_id,)
    ).one()
    if not r:
        raise HTTPException(status_code=404, detail="Беседа не найдена")
    return schemas.ChatRoomOut(
        id=r.id, title=r.title, photo=r.photo,
        created_by=r.created_by, created_at=r.created_at,
        members=_list_members(s, room_id),
    )


@router.post("/{room_id}/members/{user_id}", response_model=schemas.ChatRoomOut)
def add_member(room_id: UUID, user_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    if not _is_member(s, room_id, current["id"]):
        raise HTTPException(status_code=403, detail="Вы не участник этой беседы")
    if _is_member(s, room_id, user_id):
        return get_chat(room_id, current)
    user = s.execute("SELECT name, photo FROM users WHERE id=%s", (user_id,)).one()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    room = s.execute("SELECT title, photo FROM chat_rooms WHERE id=%s", (room_id,)).one()
    if not room:
        raise HTTPException(status_code=404, detail="Беседа не найдена")
    _add_member_to_room(s, room_id, room.title, room.photo, user_id, user.name, user.photo)
    return get_chat(room_id, current)


@router.delete("/{room_id}/members/{user_id}")
def remove_member(room_id: UUID, user_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    room = s.execute("SELECT created_by FROM chat_rooms WHERE id=%s", (room_id,)).one()
    if not room:
        raise HTTPException(status_code=404, detail="Беседа не найдена")
    # User can remove self (leave) or creator can remove anyone
    if user_id != current["id"] and room.created_by != current["id"]:
        raise HTTPException(status_code=403, detail="Только создатель может удалять участников")
    s.execute(
        "DELETE FROM chat_room_members WHERE room_id=%s AND user_id=%s",
        (room_id, user_id)
    )
    s.execute(
        "DELETE FROM chat_rooms_by_user WHERE user_id=%s AND room_id=%s",
        (user_id, room_id)
    )
    return {"status": "removed"}


@router.get("/{room_id}/messages", response_model=List[schemas.ChatMessageOut])
def list_messages(room_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    if not _is_member(s, room_id, current["id"]):
        raise HTTPException(status_code=403, detail="Вы не участник этой беседы")
    rows = s.execute(
        "SELECT msg_id, from_user_id, from_name, from_photo, text, created_at "
        "FROM chat_messages WHERE room_id=%s LIMIT 500",
        (room_id,)
    ).all()
    return [
        schemas.ChatMessageOut(
            id=r.msg_id, from_user_id=r.from_user_id, from_name=r.from_name,
            from_photo=r.from_photo, text=r.text, created_at=r.created_at,
            mine=(r.from_user_id == current["id"]),
        ) for r in rows
    ]


@router.post("/{room_id}/messages", response_model=schemas.ChatMessageOut)
def send_message(room_id: UUID, data: schemas.ChatMessageIn, current=Depends(get_current_user)):
    s = get_session()
    if not _is_member(s, room_id, current["id"]):
        raise HTTPException(status_code=403, detail="Вы не участник этой беседы")
    me = s.execute("SELECT name, photo FROM users WHERE id=%s", (current["id"],)).one()
    now = datetime.now(timezone.utc)
    mid = uuid_from_time(now)
    s.execute(
        "INSERT INTO chat_messages (room_id, msg_id, from_user_id, from_name, from_photo, text, created_at) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (room_id, mid, current["id"], me.name, me.photo, data.text, now),
    )
    # Update each member's chat_rooms_by_user with the new "last message"
    members = s.execute(
        "SELECT user_id FROM chat_room_members WHERE room_id=%s", (room_id,)
    ).all()
    room = s.execute("SELECT title, photo FROM chat_rooms WHERE id=%s", (room_id,)).one()
    for m in members:
        s.execute(
            "INSERT INTO chat_rooms_by_user (user_id, room_id, title, photo, "
            "last_message_text, last_message_at, last_from_name) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (m.user_id, room_id, room.title, room.photo, data.text, now, me.name),
        )
    return schemas.ChatMessageOut(
        id=mid, from_user_id=current["id"], from_name=me.name, from_photo=me.photo,
        text=data.text, created_at=now, mine=True,
    )
