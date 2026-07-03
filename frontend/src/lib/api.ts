/// <reference types="vite/client" />

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface ApiOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number>;
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, params } = options;

  let url = `${API_BASE}${path}`;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      searchParams.set(key, String(value));
    }
    url += `?${searchParams.toString()}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const res = await fetch(url, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err.detail || err.message || detail;
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, detail);
  }

  return res.json();
}

// ── API functions ──

export interface City {
  id: number;
  name: string;
  province_code: string;
  province_name: string | null;
  is_jabodetabek: boolean;
  price_tier: string;
}

export interface Condition {
  id: string;
  label: string;
}

export interface PlanRequest {
  condition: string;
  sex: string;
  city_id: number;
  age_group?: string;
}

export interface PlanResponse {
  plan_id: string;
  meals: MealResponse[];
  budget: Record<string, unknown>;
  macro_targets: Record<string, number>;
  notes: string | null;
}

export interface MealResponse {
  slot: string;
  name: string;
  name_en: string | null;
  description: string;
  ingredients: string[];
  nutrition: Record<string, number>;
  prep_type: string;
  dataset_item_ids: number[];
  price_idr: number;
  image_url: string | null;
}

export interface HistoryEntry {
  id: number;
  food_item_id: number;
  food_name: string | null;
  food_category: string | null;
  calories: number | null;
  served_at: string;
  slot: string;
  condition: string | null;
  plan_id: string | null;
}

export interface UserProfile {
  id: number;
  email: string;
  role: string;
  email_verified: boolean;
}

export interface UserPrefs {
  default_condition?: string;
  default_sex?: string;
  default_city_id?: number;
  daily_budget_idr?: number;
  per_meal_budget_idr?: number;
  variety_appetite?: number;
  prep_lean?: string;
  exclusions_json?: string;
}

export const api = {
  // Auth
  register: (email: string, password: string) =>
    request<{ message: string; id: number }>("/api/auth/register", {
      method: "POST",
      body: { email, password },
    }),

  login: (email: string, password: string) =>
    request<{ message: string; access_token: string }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    }),

  logout: () =>
    request<{ message: string }>("/api/auth/logout", { method: "POST" }),

  me: () => request<UserProfile>("/api/me"),

  // Preferences
  getPreferences: () =>
    request<UserPrefs>("/api/me/preferences"),

  updatePreferences: (prefs: UserPrefs) =>
    request<{ message: string }>("/api/me/preferences", {
      method: "PUT",
      body: prefs,
    }),

  // Cities
  searchCities: (q: string, limit = 10) =>
    request<City[]>("/api/cities", { params: { q, limit } }),

  // Plan
  getConditions: () =>
    request<{ conditions: Condition[] }>("/api/plan/conditions"),

  generatePlan: (body: PlanRequest) =>
    request<PlanResponse>("/api/plan", { method: "POST", body }),

  chatAdjust: (planId: string, message: string, history?: unknown[]) =>
    request<PlanResponse>("/api/chat", {
      method: "POST",
      body: { plan_id: planId, message, history },
    }),

  // Feedback
  submitFeedback: (foodItemId: number, rating: number, planId?: string) =>
    request<{ message: string; id: number; rating: number; learning?: unknown }>(
      "/api/feedback",
      { method: "POST", body: { food_item_id: foodItemId, rating, plan_id: planId } }
    ),

  // History
  getHistory: (limit = 20) =>
    request<HistoryEntry[]>("/api/history", { params: { limit } }),

  // Health
  health: () => request<{ status: string }>("/api/health"),
};