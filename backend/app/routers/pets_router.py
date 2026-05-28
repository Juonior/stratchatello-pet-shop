from datetime import datetime, timezone
from typing import List
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException
from .. import schemas
from ..auth import get_current_user
from ..database import get_session

router = APIRouter(prefix="/api/pets", tags=["pets"])


def _row_to_pet(r) -> schemas.PetOut:
    return schemas.PetOut(
        id=r.pet_id, name=r.name, breed=r.breed, age=r.age or 0,
        weight=r.weight, size=r.size, gender=r.gender,
        allergies=r.allergies or "", favorite_treat=r.favorite_treat or "",
        photo=r.photo, created_at=r.created_at,
    )


@router.get("", response_model=List[schemas.PetOut])
def list_my_pets(current=Depends(get_current_user)):
    s = get_session()
    rows = s.execute(
        "SELECT pet_id, name, breed, age, weight, size, gender, allergies, "
        "favorite_treat, photo, created_at FROM pets_by_user WHERE user_id=%s",
        (current["id"],)
    ).all()
    return [_row_to_pet(r) for r in rows]


@router.post("", response_model=schemas.PetOut)
def create_pet(data: schemas.PetIn, current=Depends(get_current_user)):
    s = get_session()
    pid = uuid4()
    now = datetime.now(timezone.utc)
    s.execute(
        "INSERT INTO pets_by_user (user_id, pet_id, name, breed, age, weight, size, "
        "gender, allergies, favorite_treat, photo, created_at) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (current["id"], pid, data.name, data.breed, data.age, data.weight,
         data.size, data.gender, data.allergies or "", data.favorite_treat or "",
         data.photo, now),
    )
    return schemas.PetOut(id=pid, created_at=now, **data.model_dump())


@router.put("/{pet_id}", response_model=schemas.PetOut)
def update_pet(pet_id: UUID, data: schemas.PetIn, current=Depends(get_current_user)):
    s = get_session()
    row = s.execute(
        "SELECT pet_id, created_at FROM pets_by_user WHERE user_id=%s AND pet_id=%s",
        (current["id"], pet_id)
    ).one()
    if not row:
        raise HTTPException(status_code=404, detail="Питомец не найден")
    s.execute(
        "INSERT INTO pets_by_user (user_id, pet_id, name, breed, age, weight, size, "
        "gender, allergies, favorite_treat, photo, created_at) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (current["id"], pet_id, data.name, data.breed, data.age, data.weight,
         data.size, data.gender, data.allergies or "", data.favorite_treat or "",
         data.photo, row.created_at),
    )
    return schemas.PetOut(id=pet_id, created_at=row.created_at, **data.model_dump())


@router.delete("/{pet_id}")
def delete_pet(pet_id: UUID, current=Depends(get_current_user)):
    s = get_session()
    s.execute("DELETE FROM pets_by_user WHERE user_id=%s AND pet_id=%s",
              (current["id"], pet_id))
    return {"ok": True}
