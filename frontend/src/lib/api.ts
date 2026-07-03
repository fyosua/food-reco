/// <reference types="vite/client" />

const API_BASE = import.meta.env.VITE_API_URL || "/api";

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
  conditions: string[];
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
  food_name_en: string | null;
  food_category: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  prep_type: string | null;
  tags_json: string | null;
  cuisine_tags_json: string | null;
  price_pasar_min: number | null;
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
  default_conditions?: string[];
  default_condition?: string;
  default_sex?: string;
  default_city_id?: number;
  daily_budget_idr?: number;
  per_meal_budget_idr?: number;
  variety_appetite?: number;
  prep_lean?: string;
  exclusions_json?: string;
}

// ── Admin Data Types ──

export interface FoodItem {
  id: number;
  name_id: string;
  name_en: string | null;
  category: string;
  prep_type: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  price_pasar_min: number | null;
  price_pasar_max: number | null;
  tags_json: string | null;
  cuisine_tags_json: string | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FoodCreate {
  name_id: string;
  name_en?: string;
  category: string;
  prep_type: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  price_pasar_min?: number;
  price_pasar_max?: number;
  tags_json?: string;
  cuisine_tags_json?: string;
  active?: boolean;
}

export interface FoodUpdate {
  name_id?: string;
  name_en?: string;
  category?: string;
  prep_type?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  price_pasar_min?: number;
  price_pasar_max?: number;
  tags_json?: string;
  cuisine_tags_json?: string;
  active?: boolean;
}

export interface Province {
  code: string;
  name: string;
  island_group: string;
  price_multiplier: number;
}

export interface ProvinceUpdate {
  name?: string;
  island_group?: string;
  price_multiplier?: number;
}

export interface AdminCity {
  id: number;
  name: string;
  province_code: string;
  province_name: string | null;
  is_jabodetabek: boolean;
  price_tier: string;
  latitude: number | null;
  longitude: number | null;
}

export interface CityCreate {
  name: string;
  province_code: string;
  province_name?: string;
  is_jabodetabek?: boolean;
  price_tier: string;
  latitude?: number;
  longitude?: number;
}

export interface CityUpdate {
  name?: string;
  province_code?: string;
  province_name?: string;
  is_jabodetabek?: boolean;
  price_tier?: string;
  latitude?: number;
  longitude?: number;
}

export interface PriceOverride {
  code: string;
  label: string;
  price_multiplier: number;
  member_provinces: string;
}

export interface OverrideUpdate {
  label?: string;
  price_multiplier?: number;
}

export interface AdminUser {
  id: number;
  email: string;
  role: string;
  email_verified: boolean;
  display_name: string | null;
  has_preferences: boolean;
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

  // Admin — Foods
  adminGetFoods: (limit = 200) =>
    request<{ items: FoodItem[]; total: number; limit: number; offset: number }>(
      "/api/admin/foods",
      { params: { limit } }
    ),
  adminGetFood: (id: number) =>
    request<FoodItem>("/api/admin/foods/" + id),
  adminCreateFood: (data: FoodCreate) =>
    request<FoodItem>("/api/admin/foods", { method: "POST", body: data }),
  adminUpdateFood: (id: number, data: FoodUpdate) =>
    request<FoodItem>("/api/admin/foods/" + id, { method: "PUT", body: data }),
  adminDeleteFood: (id: number) =>
    request<{ message: string }>("/api/admin/foods/" + id, { method: "DELETE" }),
  adminGetCategories: () =>
    request<{ categories: string[] }>("/api/admin/categories"),

  // Admin — Provinces
  adminGetProvinces: () =>
    request<{ items: Province[]; total: number }>("/api/admin/provinces"),
  adminUpdateProvince: (code: string, data: ProvinceUpdate) =>
    request<Province>("/api/admin/provinces/" + encodeURIComponent(code), {
      method: "PUT",
      body: data,
    }),

  // Admin — Cities
  adminGetCities: (limit = 200) =>
    request<{ items: AdminCity[]; total: number }>("/api/admin/cities", {
      params: { limit },
    }),
  adminCreateCity: (data: CityCreate) =>
    request<AdminCity>("/api/admin/cities", { method: "POST", body: data }),
  adminUpdateCity: (id: number, data: CityUpdate) =>
    request<AdminCity>("/api/admin/cities/" + id, {
      method: "PUT",
      body: data,
    }),
  adminDeleteCity: (id: number) =>
    request<{ message: string }>("/api/admin/cities/" + id, {
      method: "DELETE",
    }),

  // Admin — Price Overrides
  adminGetOverrides: () =>
    request<{ items: PriceOverride[]; total: number }>("/api/admin/overrides"),
  adminUpdateOverride: (code: string, data: OverrideUpdate) =>
    request<PriceOverride>("/api/admin/overrides/" + encodeURIComponent(code), {
      method: "PUT",
      body: data,
    }),

  // Admin — Users
  adminGetUsers: () =>
    request<{ items: AdminUser[]; total: number }>("/api/admin/users"),
  adminUpdateUserRole: (id: number, role: string) =>
    request<AdminUser>("/api/admin/users/" + id + "/role", {
      method: "PUT",
      body: { role },
    }),
  adminDeleteUser: (id: number) =>
    request<{ message: string }>("/api/admin/users/" + id, {
      method: "DELETE",
    }),

  // Change Password
  changePassword: (oldPassword: string, newPassword: string) =>
    request<{ message: string }>("/api/me/change-password", {
      method: "POST",
      body: { old_password: oldPassword, new_password: newPassword },
    }),

  // Health
  health: () => request<{ status: string }>("/api/health"),
};