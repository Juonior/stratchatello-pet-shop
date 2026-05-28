from datetime import datetime, timezone
from uuid import UUID, uuid4
from fastapi import APIRouter, HTTPException, Depends
from .. import schemas
from ..auth import hash_password, verify_password, create_access_token, get_current_user
from ..database import get_session

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.TokenOut)
def register(data: schemas.RegisterIn):
    s = get_session()
    existing = s.execute("SELECT user_id FROM users_by_email WHERE email=%s", (data.email.lower(),)).one()
    if existing:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже зарегистрирован")
    uid = uuid4()
    now = datetime.now(timezone.utc)
    s.execute(
        "INSERT INTO users (id, email, name, password_hash, role, photo, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (uid, data.email.lower(), data.name, hash_password(data.password), "user", None, now),
    )
    s.execute("INSERT INTO users_by_email (email, user_id) VALUES (%s, %s)", (data.email.lower(), uid))
    token = create_access_token(uid, data.email.lower())
    return schemas.TokenOut(
        access_token=token,
        user=schemas.UserOut(id=uid, email=data.email.lower(), name=data.name, role="user"),
    )


@router.post("/login", response_model=schemas.TokenOut)
def login(data: schemas.LoginIn):
    s = get_session()
    row = s.execute("SELECT user_id FROM users_by_email WHERE email=%s", (data.email.lower(),)).one()
    if not row:
        raise HTTPException(status_code=400, detail="Неверный email или пароль")
    user = s.execute(
        "SELECT id, email, name, password_hash, role, photo FROM users WHERE id=%s",
        (row.user_id,)
    ).one()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Неверный email или пароль")
    token = create_access_token(user.id, user.email)
    return schemas.TokenOut(
        access_token=token,
        user=schemas.UserOut(
            id=user.id, email=user.email, name=user.name,
            role=user.role or "user", photo=user.photo,
        ),
    )


@router.get("/me", response_model=schemas.UserOut)
def me(current=Depends(get_current_user)):
    return schemas.UserOut(**current)


@router.patch("/me", response_model=schemas.UserOut)
def update_me(data: schemas.UserUpdateIn, current=Depends(get_current_user)):
    s = get_session()
    updates = []
    values = []
    if data.name is not None:
        updates.append("name=%s")
        values.append(data.name)
    if data.photo is not None:
        updates.append("photo=%s")
        values.append(data.photo)
    if updates:
        values.append(current["id"])
        s.execute(f"UPDATE users SET {', '.join(updates)} WHERE id=%s", tuple(values))
    row = s.execute(
        "SELECT id, email, name, role, photo FROM users WHERE id=%s",
        (current["id"],)
    ).one()
    return schemas.UserOut(
        id=row.id, email=row.email, name=row.name,
        role=row.role or "user", photo=row.photo,
    )
