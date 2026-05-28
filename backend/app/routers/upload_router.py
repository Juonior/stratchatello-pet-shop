from uuid import uuid4
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from .. import s3
from ..auth import get_current_user

router = APIRouter(prefix="/api/upload", tags=["upload"])

MAX_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_KINDS = {"avatar", "pet", "user", "misc"}


class UploadOut(BaseModel):
    url: str
    key: str


@router.post("/image", response_model=UploadOut)
async def upload_image(
    file: UploadFile = File(...),
    kind: str = "misc",
    current=Depends(get_current_user),
):
    if kind not in ALLOWED_KINDS:
        kind = "misc"
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Только изображения")

    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Файл слишком большой (максимум 5 МБ)")
    if not raw:
        raise HTTPException(status_code=400, detail="Пустой файл")

    folder = {"user": "avatars/users", "avatar": "avatars/users", "pet": "avatars/pets", "misc": "uploads"}[kind]
    key = f"{folder}/{current['id']}/{uuid4().hex}"
    try:
        url = s3.upload_image_bytes(key, raw, max_side=800)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки: {e}")
    return UploadOut(url=url, key=key)
