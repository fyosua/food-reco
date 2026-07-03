# API Reference — FoodReco

Auto-generated from FastAPI. All endpoints under `/api`.

## Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register with email + password |
| POST | `/api/auth/login` | Public | Login, receive httpOnly JWT cookie |
| POST | `/api/auth/logout` | User | Logout, revoke session |

## User

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/me` | User | Current user profile + preferences |
| PUT | `/api/me/preferences` | User | Update taste profile |

## Data

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/cities?q=` | User | City search/type-ahead |

## Plans

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/plan` | User | Generate day plan: `{condition, sex, city_id}` |
| POST | `/api/chat` | User | Conversational adjustment: `{plan_id, message, history[]}` |

## Feedback

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/feedback` | User | 👍/👎 on a served meal |
| GET | `/api/history` | User | Recent served meals |

## Admin

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/foods` | Admin | Dataset browse |
| POST | `/api/admin/verify/{id}` | Admin | Promote/reject crawled row |

## System

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | Public | Liveness probe |

> Full OpenAPI schema available at `/docs` when the server is running.