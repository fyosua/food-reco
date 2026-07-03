"""Admin API endpoints — food CRUD, categories, and data management."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.routes import get_current_user
from app.core.database import get_db
from app.models.food import FoodItem
from app.models.user import User

router = APIRouter(prefix="/api/admin", tags=["admin"])


class VerifyAction(BaseModel):
    status: str  # human_verified | rejected


class FoodCreate(BaseModel):
    name_id: str = Field(..., min_length=1)
    name_en: str | None = None
    category: str | None = None
    prep_type: str | None = None
    calories: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None
    fiber_g: float | None = None
    price_pasar_min: int | None = None
    price_pasar_max: int | None = None
    tags_json: str | None = None
    cuisine_tags_json: str | None = None
    verification_status: str = "unverified"
    active: bool = False


class FoodUpdate(BaseModel):
    name_id: str | None = None
    name_en: str | None = None
    category: str | None = None
    prep_type: str | None = None
    calories: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None
    fiber_g: float | None = None
    price_pasar_min: int | None = None
    price_pasar_max: int | None = None
    tags_json: str | None = None
    cuisine_tags_json: str | None = None
    verification_status: str | None = None
    active: bool | None = None


async def require_admin(user: User) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


def _food_to_dict(item: FoodItem) -> dict:
    return {
        "id": item.id,
        "name_id": item.name_id,
        "name_en": item.name_en,
        "category": item.category,
        "prep_type": item.prep_type,
        "calories": item.calories,
        "protein_g": item.protein_g,
        "carbs_g": item.carbs_g,
        "fat_g": item.fat_g,
        "fiber_g": item.fiber_g,
        "price_pasar_min": item.price_pasar_min,
        "price_pasar_max": item.price_pasar_max,
        "tags_json": item.tags_json,
        "cuisine_tags_json": item.cuisine_tags_json,
        "verification_status": item.verification_status,
        "active": bool(item.active),
        "source_url": item.source_url,
        "image_path": item.image_path,
    }


@router.get("/foods")
async def list_foods(
    status_filter: str | None = Query(None, alias="status"),
    active_filter: bool | None = Query(None, alias="active"),
    category: str | None = None,
    limit: int = Query(5000, ge=1, le=100000),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all food items with optional filters (admin only)."""
    await require_admin(user)
    stmt = select(FoodItem).order_by(FoodItem.id)

    if status_filter:
        stmt = stmt.where(FoodItem.verification_status == status_filter)
    if active_filter is not None:
        stmt = stmt.where(FoodItem.active == active_filter)
    if category:
        stmt = stmt.where(FoodItem.category == category)

    # Get total count
    count_stmt = select(FoodItem.id).where(FoodItem.id > 0)
    if status_filter:
        count_stmt = count_stmt.where(FoodItem.verification_status == status_filter)
    if active_filter is not None:
        count_stmt = count_stmt.where(FoodItem.active == active_filter)
    if category:
        count_stmt = count_stmt.where(FoodItem.category == category)
    count_result = await db.execute(count_stmt)
    total = len(count_result.scalars().all())

    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()

    return {
        "items": [_food_to_dict(item) for item in items],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/foods/{item_id}")
async def get_food(
    item_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single food item by ID (admin only)."""
    await require_admin(user)
    result = await db.execute(select(FoodItem).where(FoodItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food item not found")
    return _food_to_dict(item)


@router.post("/foods")
async def create_food(
    body: FoodCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new food item (admin only)."""
    await require_admin(user)
    item = FoodItem(
        name_id=body.name_id,
        name_en=body.name_en,
        category=body.category,
        prep_type=body.prep_type,
        calories=body.calories,
        protein_g=body.protein_g,
        carbs_g=body.carbs_g,
        fat_g=body.fat_g,
        fiber_g=body.fiber_g,
        price_pasar_min=body.price_pasar_min,
        price_pasar_max=body.price_pasar_max,
        tags_json=body.tags_json,
        cuisine_tags_json=body.cuisine_tags_json,
        verification_status=body.verification_status,
        active=body.active,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return {"message": "Food item created", "id": item.id, "item": _food_to_dict(item)}


@router.put("/foods/{item_id}")
async def update_food(
    item_id: int,
    body: FoodUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a food item (admin only)."""
    await require_admin(user)
    result = await db.execute(select(FoodItem).where(FoodItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food item not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)

    await db.flush()
    await db.refresh(item)
    return {"message": "Food item updated", "item": _food_to_dict(item)}


@router.delete("/foods/{item_id}")
async def delete_food(
    item_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a food item (admin only)."""
    await require_admin(user)
    result = await db.execute(select(FoodItem).where(FoodItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food item not found")
    await db.delete(item)
    await db.flush()
    return {"message": "Food item deleted", "id": item_id}


@router.post("/verify/{item_id}")
async def verify_food(
    item_id: int,
    body: VerifyAction,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Promote or reject a food item (admin only)."""
    await require_admin(user)
    result = await db.execute(select(FoodItem).where(FoodItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food item not found")
    if body.status not in ("human_verified", "rejected"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be 'human_verified' or 'rejected'")
    item.verification_status = body.status
    item.verified_at = datetime.now(timezone.utc)
    item.active = body.status == "human_verified"
    await db.flush()
    return {"message": f"Item {item_id} set to {body.status}", "id": item.id, "active": bool(item.active)}


@router.get("/categories")
async def list_categories(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all distinct food categories (admin only)."""
    await require_admin(user)
    result = await db.execute(select(FoodItem.category).distinct().where(FoodItem.category.isnot(None)).order_by(FoodItem.category))
    categories = [r[0] for r in result.all()]
    return {"categories": categories}


# ── Province CRUD ──


class ProvinceCreate(BaseModel):
    code: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    island_group: str | None = None
    price_multiplier: float = 1.0


class ProvinceUpdate(BaseModel):
    name: str | None = None
    island_group: str | None = None
    price_multiplier: float | None = None


@router.get("/provinces")
async def list_provinces(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all provinces (admin only)."""
    await require_admin(user)
    from app.models.city import Province as ProvinceModel
    result = await db.execute(select(ProvinceModel).order_by(ProvinceModel.code))
    items = result.scalars().all()
    return {
        "items": [
            {
                "code": p.code,
                "name": p.name,
                "island_group": p.island_group,
                "price_multiplier": p.price_multiplier,
            }
            for p in items
        ],
        "total": len(items),
    }


@router.put("/provinces/{code}")
async def update_province(
    code: str,
    body: ProvinceUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a province (admin only)."""
    await require_admin(user)
    from app.models.city import Province as ProvinceModel
    result = await db.execute(select(ProvinceModel).where(ProvinceModel.code == code))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Province not found")
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    await db.flush()
    return {"message": "Province updated", "code": code}


# ── City CRUD ──


class CityCreate(BaseModel):
    name: str = Field(..., min_length=1)
    province_code: str = Field(..., min_length=1)
    province_name: str | None = None
    is_jabodetabek: bool = False
    price_tier: str = Field(..., min_length=1)
    latitude: float | None = None
    longitude: float | None = None


class CityUpdate(BaseModel):
    name: str | None = None
    province_code: str | None = None
    province_name: str | None = None
    is_jabodetabek: bool | None = None
    price_tier: str | None = None
    latitude: float | None = None
    longitude: float | None = None


@router.get("/cities")
async def list_cities(
    limit: int = Query(5000, ge=1, le=100000),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all cities (admin only)."""
    await require_admin(user)
    from app.models.city import City as CityModel
    stmt = select(CityModel).order_by(CityModel.name).offset(offset).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return {
        "items": [
            {
                "id": c.id,
                "name": c.name,
                "province_code": c.province_code,
                "province_name": c.province_name,
                "is_jabodetabek": bool(c.is_jabodetabek),
                "price_tier": c.price_tier,
                "latitude": c.latitude,
                "longitude": c.longitude,
            }
            for c in items
        ],
        "total": len(items),
    }


@router.post("/cities")
async def create_city(
    body: CityCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new city (admin only)."""
    await require_admin(user)
    from app.models.city import City as CityModel
    city = CityModel(
        name=body.name,
        province_code=body.province_code,
        province_name=body.province_name,
        is_jabodetabek=int(body.is_jabodetabek),
        price_tier=body.price_tier,
        latitude=body.latitude,
        longitude=body.longitude,
    )
    db.add(city)
    await db.flush()
    await db.refresh(city)
    return {"message": "City created", "id": city.id}


@router.put("/cities/{city_id}")
async def update_city(
    city_id: int,
    body: CityUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a city (admin only)."""
    await require_admin(user)
    from app.models.city import City as CityModel
    result = await db.execute(select(CityModel).where(CityModel.id == city_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="City not found")
    update_data = body.model_dump(exclude_unset=True)
    if "is_jabodetabek" in update_data:
        update_data["is_jabodetabek"] = int(update_data["is_jabodetabek"])
    for key, value in update_data.items():
        setattr(item, key, value)
    await db.flush()
    return {"message": "City updated", "id": city_id}


@router.delete("/cities/{city_id}")
async def delete_city(
    city_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a city (admin only)."""
    await require_admin(user)
    from app.models.city import City as CityModel
    result = await db.execute(select(CityModel).where(CityModel.id == city_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="City not found")
    await db.delete(item)
    await db.flush()
    return {"message": "City deleted", "id": city_id}


# ── Price Tier Override CRUD ──


class OverrideCreate(BaseModel):
    code: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1)
    price_multiplier: float = 1.0
    member_provinces: str | None = None


class OverrideUpdate(BaseModel):
    label: str | None = None
    price_multiplier: float | None = None
    member_provinces: str | None = None


@router.get("/overrides")
async def list_overrides(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all price tier overrides (admin only)."""
    await require_admin(user)
    from app.models.city import PriceTierOverride
    result = await db.execute(select(PriceTierOverride))
    items = result.scalars().all()
    return {
        "items": [
            {
                "code": o.code,
                "label": o.label,
                "price_multiplier": o.price_multiplier,
                "member_provinces": o.member_provinces,
            }
            for o in items
        ],
        "total": len(items),
    }


@router.put("/overrides/{code}")
async def update_override(
    code: str,
    body: OverrideUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a price tier override (admin only)."""
    await require_admin(user)
    from app.models.city import PriceTierOverride
    result = await db.execute(select(PriceTierOverride).where(PriceTierOverride.code == code))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Override not found")
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    await db.flush()
    return {"message": "Override updated", "code": code}


# ── Users management ──


@router.get("/users")
async def list_users(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users (admin only)."""
    await require_admin(user)
    from app.models.user import User as UserModel
    from app.models.prefs import UserPref
    result = await db.execute(
        select(UserModel).order_by(UserModel.id)
    )
    users_list = result.scalars().all()

    # Get preference count for each user
    prefs_result = await db.execute(
        select(UserPref.user_id).where(UserPref.user_id > 0)
    )
    users_with_prefs = set(r[0] for r in prefs_result.all() if r[0])

    return {
        "items": [
            {
                "id": u.id,
                "email": u.email,
                "role": u.role,
                "email_verified": bool(u.email_verified),
                "display_name": u.display_name,
                "has_preferences": u.id in users_with_prefs,
            }
            for u in users_list
        ],
        "total": len(users_list),
    }


@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a user's role (admin only)."""
    await require_admin(user)
    from app.models.user import User as UserModel
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    new_role = body.get("role")
    if new_role not in ("user", "admin"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Role must be 'user' or 'admin'")
    target.role = new_role
    await db.flush()
    return {"message": f"User {user_id} role updated to {new_role}", "id": user_id, "role": new_role}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a user (admin only). Cannot delete yourself."""
    await require_admin(user)
    if user_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete yourself")
    from app.models.user import User as UserModel
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await db.delete(target)
    await db.flush()
    return {"message": f"User {user_id} deleted", "id": user_id}


# ── Health Conditions CRUD ──


class HealthConditionCreate(BaseModel):
    code: str = Field(..., min_length=1)
    name_id: str = Field(..., min_length=1)
    label_en: str | None = None
    sex: str | None = None
    forbidden_tags_json: str | None = None
    extra_constraints_json: str | None = None
    macros_json: str | None = None
    active: bool = True


class HealthConditionUpdate(BaseModel):
    name_id: str | None = None
    label_en: str | None = None
    sex: str | None = None
    forbidden_tags_json: str | None = None
    extra_constraints_json: str | None = None
    macros_json: str | None = None
    active: bool | None = None


def _health_condition_to_dict(item) -> dict:
    return {
        "id": item.id,
        "code": item.code,
        "name_id": item.name_id,
        "label_en": item.label_en,
        "sex": item.sex,
        "forbidden_tags_json": item.forbidden_tags_json,
        "extra_constraints_json": item.extra_constraints_json,
        "macros_json": item.macros_json,
        "active": bool(item.active),
    }


@router.get("/conditions")
async def list_conditions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all health conditions (admin only)."""
    await require_admin(user)
    from app.models.health_condition import HealthCondition as HC
    result = await db.execute(select(HC).order_by(HC.code))
    items = result.scalars().all()
    return {
        "items": [_health_condition_to_dict(item) for item in items],
        "total": len(items),
    }


@router.post("/conditions")
async def create_condition(
    body: HealthConditionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new health condition (admin only)."""
    await require_admin(user)
    from app.models.health_condition import HealthCondition as HC
    item = HC(
        code=body.code,
        name_id=body.name_id,
        label_en=body.label_en,
        sex=body.sex,
        forbidden_tags_json=body.forbidden_tags_json,
        extra_constraints_json=body.extra_constraints_json,
        macros_json=body.macros_json,
        active=body.active,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return {"message": "Health condition created", "item": _health_condition_to_dict(item)}


@router.put("/conditions/{code}")
async def update_condition(
    code: str,
    body: HealthConditionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a health condition by code (admin only)."""
    await require_admin(user)
    from app.models.health_condition import HealthCondition as HC
    result = await db.execute(select(HC).where(HC.code == code))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Health condition not found")
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    await db.flush()
    await db.refresh(item)
    return {"message": "Health condition updated", "item": _health_condition_to_dict(item)}


@router.delete("/conditions/{code}")
async def delete_condition(
    code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a health condition by code (admin only)."""
    await require_admin(user)
    from app.models.health_condition import HealthCondition as HC
    result = await db.execute(select(HC).where(HC.code == code))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Health condition not found")
    await db.delete(item)
    await db.flush()
    return {"message": "Health condition deleted", "code": code}


# ── Tag Catalog CRUD ──


class TagCatalogCreate(BaseModel):
    code: str = Field(..., min_length=1)
    name_id: str = Field(..., min_length=1)
    label_en: str | None = None
    category: str = Field(..., min_length=1)
    description: str | None = None
    active: bool = True


class TagCatalogUpdate(BaseModel):
    name_id: str | None = None
    label_en: str | None = None
    category: str | None = None
    description: str | None = None
    active: bool | None = None


def _tag_catalog_to_dict(item) -> dict:
    return {
        "id": item.id,
        "code": item.code,
        "name_id": item.name_id,
        "label_en": item.label_en,
        "category": item.category,
        "description": item.description,
        "active": bool(item.active),
    }


@router.get("/tags/categories")
async def list_tag_categories(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all distinct tag categories (admin only)."""
    await require_admin(user)
    from app.models.tag_catalog import TagCatalog as TC
    result = await db.execute(
        select(TC.category).distinct().where(TC.category.isnot(None)).order_by(TC.category)
    )
    categories = [r[0] for r in result.all()]
    return {"categories": categories}


@router.get("/tags")
async def list_tags(
    category: str | None = Query(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all tags, optionally filtered by category (admin only)."""
    await require_admin(user)
    from app.models.tag_catalog import TagCatalog as TC
    stmt = select(TC).order_by(TC.code)
    if category:
        stmt = stmt.where(TC.category == category)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return {
        "items": [_tag_catalog_to_dict(item) for item in items],
        "total": len(items),
    }


@router.post("/tags")
async def create_tag(
    body: TagCatalogCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new tag catalog entry (admin only)."""
    await require_admin(user)
    from app.models.tag_catalog import TagCatalog as TC
    item = TC(
        code=body.code,
        name_id=body.name_id,
        label_en=body.label_en,
        category=body.category,
        description=body.description,
        active=body.active,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return {"message": "Tag created", "item": _tag_catalog_to_dict(item)}


@router.put("/tags/{code}")
async def update_tag(
    code: str,
    body: TagCatalogUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a tag catalog entry by code (admin only)."""
    await require_admin(user)
    from app.models.tag_catalog import TagCatalog as TC
    result = await db.execute(select(TC).where(TC.code == code))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    await db.flush()
    await db.refresh(item)
    return {"message": "Tag updated", "item": _tag_catalog_to_dict(item)}


@router.delete("/tags/{code}")
async def delete_tag(
    code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a tag catalog entry by code (admin only)."""
    await require_admin(user)
    from app.models.tag_catalog import TagCatalog as TC
    result = await db.execute(select(TC).where(TC.code == code))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tag not found")
    await db.delete(item)
    await db.flush()
    return {"message": "Tag deleted", "code": code}


# ── Cuisine Types CRUD ──


class CuisineTypeCreate(BaseModel):
    code: str = Field(..., min_length=1)
    name_id: str = Field(..., min_length=1)
    label_en: str | None = None
    island_group: str | None = None
    active: bool = True


class CuisineTypeUpdate(BaseModel):
    name_id: str | None = None
    label_en: str | None = None
    island_group: str | None = None
    active: bool | None = None


def _cuisine_type_to_dict(item) -> dict:
    return {
        "id": item.id,
        "code": item.code,
        "name_id": item.name_id,
        "label_en": item.label_en,
        "island_group": item.island_group,
        "active": bool(item.active),
    }


@router.get("/cuisines")
async def list_cuisines(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all cuisine types (admin only)."""
    await require_admin(user)
    from app.models.cuisine_type import CuisineType as CT
    result = await db.execute(select(CT).order_by(CT.code))
    items = result.scalars().all()
    return {
        "items": [_cuisine_type_to_dict(item) for item in items],
        "total": len(items),
    }


@router.post("/cuisines")
async def create_cuisine(
    body: CuisineTypeCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new cuisine type (admin only)."""
    await require_admin(user)
    from app.models.cuisine_type import CuisineType as CT
    item = CT(
        code=body.code,
        name_id=body.name_id,
        label_en=body.label_en,
        island_group=body.island_group,
        active=body.active,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return {"message": "Cuisine type created", "item": _cuisine_type_to_dict(item)}


@router.put("/cuisines/{code}")
async def update_cuisine(
    code: str,
    body: CuisineTypeUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a cuisine type by code (admin only)."""
    await require_admin(user)
    from app.models.cuisine_type import CuisineType as CT
    result = await db.execute(select(CT).where(CT.code == code))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuisine type not found")
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
    await db.flush()
    await db.refresh(item)
    return {"message": "Cuisine type updated", "item": _cuisine_type_to_dict(item)}


@router.delete("/cuisines/{code}")
async def delete_cuisine(
    code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a cuisine type by code (admin only)."""
    await require_admin(user)
    from app.models.cuisine_type import CuisineType as CT
    result = await db.execute(select(CT).where(CT.code == code))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cuisine type not found")
    await db.delete(item)
    await db.flush()
    return {"message": "Cuisine type deleted", "code": code}