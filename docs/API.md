# API Reference — FoodReco

Auto-generated from FastAPI. All endpoints under `/api`.

## Error Envelope

All errors return a consistent JSON envelope:

```json
{
  "detail": "Human-readable error message"
}
```

HTTP status codes used:
| Status | Meaning |
|--------|---------|
| 200 | Success |
| 400 | Bad request (validation error, invalid input) |
| 401 | Not authenticated (missing or invalid JWT cookie) |
| 403 | Forbidden (insufficient permissions or registration disabled) |
| 404 | Resource not found |
| 429 | Rate limit exceeded |

Validation errors (Pydantic) return FastAPI's default `422` format with field-level details.

---

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | Public | Register with email + password (currently disabled — returns 403) |
| POST | `/api/auth/login` | Public | Login, receive httpOnly JWT cookie (`access_token`, `refresh_token`) |
| POST | `/api/auth/logout` | User | Logout, clear auth cookies |

### POST /api/auth/login

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "supersecret"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user_id": 1,
  "email": "user@example.com"
}
```

Cookies set: `access_token` (1 hour), `refresh_token` (7 days) — both httpOnly, samesite=lax.

---

## User Profile & Preferences

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/me` | User | Current user profile (id, email, role, display_name, email_verified) |
| GET | `/api/me/preferences` | User | Get taste preferences |
| PUT | `/api/me/preferences` | User | Update taste profile |
| POST | `/api/me/change-password` | User | Change password |
| POST | `/api/me/send-verification` | User | Generate email verification token |
| GET | `/api/me/verify-email?token=` | Public | Verify email using one-time token |

### PUT /api/me/preferences

**Request body** (all fields optional):
```json
{
  "default_condition": "diabetes,hypertension",
  "default_conditions": ["diabetes", "hypertension"],
  "default_sex": "male",
  "default_city_id": 101,
  "daily_budget_idr": 50000,
  "per_meal_budget_idr": 20000,
  "variety_appetite": 0.7,
  "prep_lean": "balanced",
  "exclusions": ["MSG", "kandungan_pengawet"],
  "tastes": [
    {"kind": "like", "value": "ayam", "weight": 1.0, "source": "onboarding"},
    {"kind": "cuisine", "value": "jawa", "weight": 1.0, "source": "onboarding"}
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `default_condition` | string | Legacy single-condition field (comma-separated) |
| `default_conditions` | array of strings | Current condition list (preferred — ingested as JSON list) |
| `default_sex` | string | `male` or `female` |
| `default_city_id` | int | Default city ID for plan generation |
| `daily_budget_idr` | int | Daily budget override in IDR |
| `per_meal_budget_idr` | int | Per-meal budget override in IDR |
| `variety_appetite` | float | 0.0–1.0 appetite for variety |
| `prep_lean` | string | `buy_ready`, `simple_cook`, or `balanced` |
| `exclusions` | array of strings | Food tags/ingredients to exclude |
| `tastes` | array of objects | Rich preference entries (kind, value, weight, source) |

**TasteEntry kind values:** `like`, `soft_dislike`, `cuisine`, `spice`, `learned`

### POST /api/me/change-password

**Request body:**
```json
{
  "old_password": "current_password",
  "new_password": "new_password_at_least_6_chars"
}
```

**Response (200):**
```json
{
  "message": "Password berhasil diubah"
}
```

---

## Data / City Search

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/cities?q=` | User | Type-ahead city search by name |

### GET /api/cities

**Query parameters:** `q` (search string, max 100 chars), `limit` (1–1000, default 10)

**Response (200):**
```json
[
  {
    "id": 101,
    "name": "Jakarta Pusat",
    "province_code": "DKI",
    "province_name": "DKI Jakarta",
    "is_jabodetabek": true,
    "price_tier": "premium"
  }
]
```

---

## Plans & Recommendations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/plan/conditions` | User | List available health conditions from DB |
| POST | `/api/plan` | User | Generate a day plan |
| POST | `/api/chat` | User | Conversational adjustment of an existing plan |

### GET /api/plan/conditions

Returns health conditions that are active in the database (admin-managed).

**Response (200):**
```json
{
  "conditions": [
    {"id": "diabetes", "label": "Diabetes", "sex": null},
    {"id": "hypertension", "label": "Hipertensi", "sex": null}
  ]
}
```

### POST /api/plan

**Request body:**
```json
{
  "conditions": ["diabetes"],
  "sex": "male",
  "city_id": 101,
  "age_group": "adult",
  "daily_budget_idr": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `conditions` | array of strings | Yes | Health condition codes (use `["none"]` for no condition) |
| `sex` | string | Yes | `male` or `female` |
| `city_id` | int | Yes | City ID for price tier resolution |
| `age_group` | string | Yes | `adult`, `elderly`, or `teen` |
| `daily_budget_idr` | int | No | Optional daily budget override |

**Response (200):**
```json
{
  "plan_id": "plan_1_20250703093000",
  "meals": [
    {
      "slot": "breakfast",
      "name": "Nasi Uduk",
      "name_en": "Coconut Rice",
      "description": "Nasi uduk dengan telur dan tempe",
      "ingredients": ["nasi", "kelapa", "telur", "tempe"],
      "nutrition": {"calories": 450, "protein_g": 15, "carbs_g": 55, "fat_g": 18},
      "prep_type": "buy_ready",
      "dataset_item_ids": [42, 87],
      "price_idr": 12000,
      "image_url": null
    }
  ],
  "budget": {
    "total_cost_idr": 45000,
    "multiplier": 1.2,
    "price_tier": "premium",
    "city": "Jakarta Pusat"
  },
  "macro_targets": {
    "calories": 2000,
    "protein_g": 65,
    "carbs_g": 275,
    "fat_g": 65,
    "fiber_g": 30
  },
  "notes": null
}
```

### POST /api/chat

**Request body:**
```json
{
  "plan_id": "plan_1_20250703093000",
  "message": "Can you replace lunch with something lighter?",
  "history": [
    {"role": "user", "content": "adjust..."},
    {"role": "assistant", "content": "Sure..."}
  ]
}
```

Response has the same `PlanResponse` shape as `POST /api/plan`.

---

## Feedback

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/feedback` | User | 👍/👎 on a served meal (triggers implicit learning) |
| GET | `/api/history` | User | Recent served meals with food details |

### POST /api/feedback

**Request body:**
```json
{
  "food_item_id": 42,
  "plan_id": "plan_1_20250703093000",
  "rating": 1
}
```

`rating`: `+1` (like), `-1` (dislike). Also updates user's taste profile via implicit learning.

### GET /api/history

**Query parameters:** `limit` (1–100, default 20)

Returns meals ordered by `served_at` descending, with full food details.

---

## System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | Public | Liveness probe |

### GET /api/health

**Response (200):**
```json
{
  "status": "ok",
  "app": "FoodReco",
  "version": "1.0.0"
}
```

---

## Admin

All admin endpoints require the authenticated user to have role `admin`. Returns 403 if the user is not an admin.

### Foods

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/foods` | List food items with search/pagination |
| GET | `/api/admin/foods/{item_id}` | Get single food item by ID |
| POST | `/api/admin/foods` | Create a new food item |
| PUT | `/api/admin/foods/{item_id}` | Update a food item |
| DELETE | `/api/admin/foods/{item_id}` | Delete a food item |
| POST | `/api/admin/verify/{item_id}` | Promote/reject a crawled food row |
| GET | `/api/admin/categories` | List distinct food categories |

#### GET /api/admin/foods

**Query parameters:** `status`, `active`, `category`, `limit` (max 100000, default 5000), `offset` (default 0)

**Response:**
```json
{
  "items": [...],
  "total": 1234,
  "limit": 5000,
  "offset": 0
}
```

#### POST /api/admin/verify/{item_id}

**Request body:**
```json
{
  "status": "human_verified"
}
```

`status` must be `human_verified` or `rejected`.

### Provinces

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/provinces` | List all provinces |
| PUT | `/api/admin/provinces/{code}` | Update a province by code |

### Cities

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/cities` | List all cities (paginated) |
| POST | `/api/admin/cities` | Create a new city |
| PUT | `/api/admin/cities/{city_id}` | Update a city by ID |
| DELETE | `/api/admin/cities/{city_id}` | Delete a city by ID |

### Price Tier Overrides

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/overrides` | List all price tier overrides |
| PUT | `/api/admin/overrides/{code}` | Update a price tier override by code |

### Users

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List all users |
| PUT | `/api/admin/users/{user_id}/role` | Update a user's role (`user` or `admin`) |
| DELETE | `/api/admin/users/{user_id}` | Delete a user (cannot delete yourself) |

### Health Conditions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/conditions` | List all health conditions |
| POST | `/api/admin/conditions` | Create a new health condition |
| PUT | `/api/admin/conditions/{code}` | Update a health condition by code |
| DELETE | `/api/admin/conditions/{code}` | Delete a health condition by code |

### Tags (Tag Catalog)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/tags/categories` | List distinct tag categories |
| GET | `/api/admin/tags?category=` | List tags, optionally filtered by category |
| POST | `/api/admin/tags` | Create a new tag catalog entry |
| PUT | `/api/admin/tags/{code}` | Update a tag by code |
| DELETE | `/api/admin/tags/{code}` | Delete a tag by code |

### Cuisine Types

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/cuisines` | List all cuisine types |
| POST | `/api/admin/cuisines` | Create a new cuisine type |
| PUT | `/api/admin/cuisines/{code}` | Update a cuisine type by code |
| DELETE | `/api/admin/cuisines/{code}` | Delete a cuisine type by code |

---

> Full OpenAPI schema available at `/docs` when the server is running.