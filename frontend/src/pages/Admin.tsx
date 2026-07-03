import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import {
  api,
  type FoodItem,
  type FoodCreate,
  type FoodUpdate,
  type Province,
  type AdminCity,
  type CityCreate,
  type PriceOverride,
  type AdminUser,
} from "../lib/api";
import { useSortable, SortIcon, LimitSelector, Pagination } from "../lib/sortable";

/* ─── Types ─── */

type TabKey = "makanan" | "provinsi" | "kota" | "override" | "users";

interface TabDef {
  key: TabKey;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { key: "makanan", label: "Makanan", icon: "🍽️" },
  { key: "provinsi", label: "Provinsi", icon: "🗺️" },
  { key: "kota", label: "Kota", icon: "🏙️" },
  { key: "override", label: "Override", icon: "💰" },
  { key: "users", label: "Users", icon: "👥" },
];

/* ─── Food Tab Types ─── */

type ModalMode = "create" | "edit";

interface ModalState {
  open: boolean;
  mode: ModalMode;
  food: FoodItem | null;
}

interface DeleteState {
  open: boolean;
  food: FoodItem | null;
  deleting: boolean;
}

interface FormData {
  name_id: string;
  name_en: string;
  category: string;
  prep_type: string;
  calories: string;
  protein_g: string;
  carbs_g: string;
  fat_g: string;
  fiber_g: string;
  price_pasar_min: string;
  price_pasar_max: string;
  tags_json: string;
  cuisine_tags_json: string;
  active: boolean;
}

const emptyForm = (): FormData => ({
  name_id: "",
  name_en: "",
  category: "",
  prep_type: "",
  calories: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
  fiber_g: "",
  price_pasar_min: "",
  price_pasar_max: "",
  tags_json: "",
  cuisine_tags_json: "",
  active: true,
});

const PREP_TYPES = ["buy_ready", "simple_cook"];

/* ─── Helpers ─── */

function parseTags(val: string): string | null {
  const trimmed = val.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("[")) return trimmed;
  const items = trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return JSON.stringify(items);
}

function formatTags(val: string | null): string {
  if (!val) return "";
  try {
    const parsed = JSON.parse(val);
    if (Array.isArray(parsed)) return parsed.join(", ");
    return val;
  } catch {
    return val;
  }
}

function formatPrice(val: number | null): string {
  if (val === null || val === undefined) return "-";
  return "Rp " + val.toLocaleString("id-ID");
}

function formatCalories(val: number): string {
  return Math.round(val) + " kcal";
}

/* ─── Tab: Makanan ─── */

function FoodsTab() {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterActive, setFilterActive] = useState("");
  const [modal, setModal] = useState<ModalState>({
    open: false,
    mode: "create",
    food: null,
  });
  const [form, setForm] = useState<FormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [del, setDel] = useState<DeleteState>({
    open: false,
    food: null,
    deleting: false,
  });

  const modalRef = useRef<HTMLDivElement>(null);
  const deleteRef = useRef<HTMLDivElement>(null);

  const fetchFoods = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.adminGetFoods(100000);
      setFoods(res.items);
      setTotal(res.total);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat data makanan";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.adminGetCategories();
      setCategories(res.categories);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchFoods();
    fetchCategories();
  }, [fetchFoods, fetchCategories]);

  const filteredFoods = foods.filter((f) => {
    if (search) {
      const q = search.toLowerCase();
      const matchesName =
        f.name_id.toLowerCase().includes(q) ||
        (f.name_en && f.name_en.toLowerCase().includes(q));
      if (!matchesName) return false;
    }
    if (filterCategory && f.category !== filterCategory) return false;
    if (filterActive === "active" && !f.active) return false;
    if (filterActive === "inactive" && f.active) return false;
    return true;
  });

  const { sorted: sortedFoods, sortField, sortDir, toggleSort, limit, setLimit, page, totalPages, totalItems, nextPage, prevPage, hasNext, hasPrev } = useSortable(filteredFoods, "name_id" as keyof FoodItem);

  function openCreateModal() {
    setForm(emptyForm());
    setFormError(null);
    setModal({ open: true, mode: "create", food: null });
  }

  function openEditModal(food: FoodItem) {
    setForm({
      name_id: food.name_id,
      name_en: food.name_en || "",
      category: food.category,
      prep_type: food.prep_type,
      calories: String(food.calories),
      protein_g: String(food.protein_g),
      carbs_g: String(food.carbs_g),
      fat_g: String(food.fat_g),
      fiber_g: String(food.fiber_g),
      price_pasar_min: food.price_pasar_min !== null ? String(food.price_pasar_min) : "",
      price_pasar_max: food.price_pasar_max !== null ? String(food.price_pasar_max) : "",
      tags_json: formatTags(food.tags_json),
      cuisine_tags_json: formatTags(food.cuisine_tags_json),
      active: food.active,
    });
    setFormError(null);
    setModal({ open: true, mode: "edit", food });
  }

  function closeModal() {
    setModal({ open: false, mode: "create", food: null });
    setFormError(null);
  }

  function updateFormField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    const payload: FoodCreate = {
      name_id: form.name_id.trim(),
      name_en: form.name_en.trim() || undefined,
      category: form.category,
      prep_type: form.prep_type,
      calories: parseFloat(form.calories) || 0,
      protein_g: parseFloat(form.protein_g) || 0,
      carbs_g: parseFloat(form.carbs_g) || 0,
      fat_g: parseFloat(form.fat_g) || 0,
      fiber_g: parseFloat(form.fiber_g) || 0,
      price_pasar_min: form.price_pasar_min ? parseFloat(form.price_pasar_min) : undefined,
      price_pasar_max: form.price_pasar_max ? parseFloat(form.price_pasar_max) : undefined,
      tags_json: parseTags(form.tags_json) ?? undefined,
      cuisine_tags_json: parseTags(form.cuisine_tags_json) ?? undefined,
      active: form.active,
    };

    try {
      if (modal.mode === "create") {
        await api.adminCreateFood(payload);
      } else if (modal.food) {
        const updatePayload: FoodUpdate = {};
        if (payload.name_id !== undefined) updatePayload.name_id = payload.name_id;
        if (payload.name_en !== undefined) updatePayload.name_en = payload.name_en;
        if (payload.category !== undefined) updatePayload.category = payload.category;
        if (payload.prep_type !== undefined) updatePayload.prep_type = payload.prep_type;
        if (payload.calories !== undefined) updatePayload.calories = payload.calories;
        if (payload.protein_g !== undefined) updatePayload.protein_g = payload.protein_g;
        if (payload.carbs_g !== undefined) updatePayload.carbs_g = payload.carbs_g;
        if (payload.fat_g !== undefined) updatePayload.fat_g = payload.fat_g;
        if (payload.fiber_g !== undefined) updatePayload.fiber_g = payload.fiber_g;
        if (payload.price_pasar_min !== undefined) updatePayload.price_pasar_min = payload.price_pasar_min;
        if (payload.price_pasar_max !== undefined) updatePayload.price_pasar_max = payload.price_pasar_max;
        if (payload.tags_json !== undefined) updatePayload.tags_json = payload.tags_json;
        if (payload.cuisine_tags_json !== undefined) updatePayload.cuisine_tags_json = payload.cuisine_tags_json;
        updatePayload.active = payload.active;
        await api.adminUpdateFood(modal.food.id, updatePayload);
      }
      closeModal();
      await fetchFoods();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan data";
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  function openDeleteModal(food: FoodItem) {
    setDel({ open: true, food, deleting: false });
  }

  function closeDeleteModal() {
    setDel({ open: false, food: null, deleting: false });
  }

  async function handleDelete() {
    if (!del.food) return;
    setDel((prev) => ({ ...prev, deleting: true }));
    try {
      await api.adminDeleteFood(del.food.id);
      closeDeleteModal();
      await fetchFoods();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus makanan";
      alert(msg);
      setDel((prev) => ({ ...prev, deleting: false }));
    }
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (del.open) closeDeleteModal();
        else if (modal.open) closeModal();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [modal.open, del.open]);

  useEffect(() => {
    if (!modal.open) return;
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        closeModal();
      }
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [modal.open]);

  useEffect(() => {
    if (!del.open) return;
    const handler = (e: MouseEvent) => {
      if (deleteRef.current && !deleteRef.current.contains(e.target as Node)) {
        closeDeleteModal();
      }
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [del.open]);

  return (
    <>
      {/* Header & Filters */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">
          Kelola database makanan — {total} total item
        </p>
        <button
          onClick={openCreateModal}
          className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors shadow-sm flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Tambah Makanan
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cari Nama</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari makanan..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Kategori</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 bg-white"
            >
              <option value="">Semua Kategori</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 bg-white"
            >
              <option value="">Semua Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Gagal memuat data</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
          <button onClick={fetchFoods} className="text-sm text-red-600 hover:text-red-800 font-medium shrink-0">Coba lagi</button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-400">Memuat data makanan...</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="flex items-center justify-end px-4 py-2 border-b border-gray-100">
            <LimitSelector limit={limit} onChange={setLimit} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("id" as keyof FoodItem)}>ID{SortIcon("id", String(sortField), sortDir)}</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("name_id" as keyof FoodItem)}>Nama{SortIcon("name_id", String(sortField), sortDir)}</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("category" as keyof FoodItem)}>Kategori{SortIcon("category", String(sortField), sortDir)}</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("calories" as keyof FoodItem)}>Kalori{SortIcon("calories", String(sortField), sortDir)}</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("price_pasar_min" as keyof FoodItem)}>Harga{SortIcon("price_pasar_min", String(sortField), sortDir)}</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Tags</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("prep_type" as keyof FoodItem)}>Prep{SortIcon("prep_type", String(sortField), sortDir)}</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("active" as keyof FoodItem)}>Active{SortIcon("active", String(sortField), sortDir)}</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedFoods.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                      {search || filterCategory || filterActive
                        ? "Tidak ada makanan yang sesuai filter."
                        : "Belum ada data makanan."}
                    </td>
                  </tr>
                ) : (
                  sortedFoods.map((food) => (
                    <tr key={food.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{food.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{food.name_id}</div>
                        {food.name_en && <div className="text-xs text-gray-400">{food.name_en}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{food.category}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-sm">{formatCalories(food.calories)}</td>
                      <td className="px-4 py-3 text-gray-700 text-sm whitespace-nowrap">
                        {formatPrice(food.price_pasar_min)}
                        {food.price_pasar_max !== null && food.price_pasar_min !== null ? " – " + formatPrice(food.price_pasar_max) : ""}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {(() => {
                            try {
                              const tags: string[] = food.tags_json ? JSON.parse(food.tags_json) : [];
                              return tags.slice(0, 3).map((t) => (
                                <span key={t} className="inline-block bg-primary-50 text-primary-600 text-[10px] px-1.5 py-0.5 rounded">{t}</span>
                              ));
                            } catch {
                              return <span className="text-[10px] text-gray-400">—</span>;
                            }
                          })()}
                          {(() => {
                            try {
                              const tags: string[] = food.tags_json ? JSON.parse(food.tags_json) : [];
                              return tags.length > 3 ? <span className="text-[10px] text-gray-400">+{tags.length - 3}</span> : null;
                            } catch {
                              return null;
                            }
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs capitalize text-gray-500">{food.prep_type}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${food.active ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"}`}>
                          {food.active ? "✓" : "✗"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditModal(food)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => openDeleteModal(food)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
            <Pagination page={page} totalPages={totalPages} totalItems={totalItems} hasPrev={hasPrev} hasNext={hasNext} onPrev={prevPage} onNext={nextPage} />
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Food */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div ref={modalRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{modal.mode === "create" ? "Tambah Makanan" : "Edit Makanan"}</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {modal.mode === "create" ? "Isi detail makanan baru" : `Mengedit ID #${modal.food?.id}`}
                </p>
              </div>
              <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-4 space-y-4">
              {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{formError}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nama (ID) <span className="text-red-400">*</span></label>
                  <input type="text" required value={form.name_id} onChange={(e) => updateFormField("name_id", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500" placeholder="Nasi Goreng" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Nama (EN)</label>
                  <input type="text" value={form.name_en} onChange={(e) => updateFormField("name_en", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500" placeholder="Fried Rice" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Kategori <span className="text-red-400">*</span></label>
                  {categories.length > 0 ? (
                    <select required value={form.category} onChange={(e) => updateFormField("category", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 bg-white">
                      <option value="">Pilih kategori</option>
                      {categories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
                    </select>
                  ) : (
                    <input type="text" required value={form.category} onChange={(e) => updateFormField("category", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500" placeholder="Kategori" />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Prep Type <span className="text-red-400">*</span></label>
                  <select required value={form.prep_type} onChange={(e) => updateFormField("prep_type", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 bg-white">
                    <option value="">Pilih tipe</option>
                    {PREP_TYPES.map((t) => (<option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-2">Nutrisi per Porsi</label>
                <div className="grid grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Kalori *</label>
                    <input type="number" required min={0} step={0.1} value={form.calories} onChange={(e) => updateFormField("calories", e.target.value)}
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Protein (g)</label>
                    <input type="number" min={0} step={0.1} value={form.protein_g} onChange={(e) => updateFormField("protein_g", e.target.value)}
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Carbs (g)</label>
                    <input type="number" min={0} step={0.1} value={form.carbs_g} onChange={(e) => updateFormField("carbs_g", e.target.value)}
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Fat (g)</label>
                    <input type="number" min={0} step={0.1} value={form.fat_g} onChange={(e) => updateFormField("fat_g", e.target.value)}
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-0.5">Fiber (g)</label>
                    <input type="number" min={0} step={0.1} value={form.fiber_g} onChange={(e) => updateFormField("fiber_g", e.target.value)}
                      className="w-full px-2 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Harga Min (Rp)</label>
                  <input type="number" min={0} value={form.price_pasar_min} onChange={(e) => updateFormField("price_pasar_min", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500" placeholder="10000" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Harga Max (Rp)</label>
                  <input type="number" min={0} value={form.price_pasar_max} onChange={(e) => updateFormField("price_pasar_max", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500" placeholder="25000" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tags <span className="text-gray-400 font-normal">(JSON array atau koma)</span></label>
                  <input type="text" value={form.tags_json} onChange={(e) => updateFormField("tags_json", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500" placeholder="goreng, pedas, populer" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Cuisine Tags <span className="text-gray-400 font-normal">(JSON array atau koma)</span></label>
                  <input type="text" value={form.cuisine_tags_json} onChange={(e) => updateFormField("cuisine_tags_json", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500" placeholder="indonesia, jawa, sunda" />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={(e) => updateFormField("active", e.target.checked)} className="sr-only peer" />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
                </label>
                <span className="text-sm text-gray-700 font-medium">Active</span>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 mt-6">
                <button type="button" onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">Batal</button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm flex items-center gap-2">
                  {saving ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {modal.mode === "create" ? "Simpan" : "Perbarui"}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {del.open && del.food && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div ref={deleteRef} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 pt-6 pb-2">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-center text-gray-800">Hapus Makanan</h3>
              <p className="text-sm text-gray-500 text-center mt-1">
                Apakah kamu yakin ingin menghapus<br />
                <span className="font-semibold text-gray-700">{del.food.name_id}</span>?
              </p>
              <p className="text-xs text-gray-400 text-center mt-2">Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="px-6 pb-6 pt-4 flex gap-3">
              <button onClick={closeDeleteModal} disabled={del.deleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200">Batal</button>
              <button onClick={handleDelete} disabled={del.deleting}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 rounded-lg transition-colors flex items-center justify-center gap-2">
                {del.deleting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menghapus...</> : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Tab: Provinsi ─── */

function ProvincesTab() {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", island_group: "", price_multiplier: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.adminGetProvinces();
      setProvinces(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat provinsi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { sorted: sortedProvinces, sortField, sortDir, toggleSort, limit, setLimit, page, totalPages, totalItems, nextPage, prevPage, hasNext, hasPrev } = useSortable(provinces, "name" as keyof Province);

  function startEdit(p: Province) {
    setEditingCode(p.code);
    setEditForm({
      name: p.name,
      island_group: p.island_group,
      price_multiplier: String(p.price_multiplier),
    });
  }

  function cancelEdit() {
    setEditingCode(null);
  }

  async function handleSave(code: string) {
    setSaving(true);
    try {
      await api.adminUpdateProvince(code, {
        name: editForm.name.trim(),
        island_group: editForm.island_group.trim(),
        price_multiplier: parseFloat(editForm.price_multiplier) || 1.0,
      });
      setEditingCode(null);
      await fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="bg-white rounded-xl border border-gray-200 p-12 text-center"><div className="inline-block w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-3" /><p className="text-sm text-gray-400">Memuat provinsi...</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">{provinces.length} total provinsi</p>
        <button onClick={fetchData} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg> Refresh
        </button>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">{error}</div>}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="flex items-center justify-end px-4 py-2 border-b border-gray-100">
          <LimitSelector limit={limit} onChange={setLimit} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("code" as keyof Province)}>Kode{SortIcon("code", String(sortField), sortDir)}</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("name" as keyof Province)}>Nama Provinsi{SortIcon("name", String(sortField), sortDir)}</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("island_group" as keyof Province)}>Pulau{SortIcon("island_group", String(sortField), sortDir)}</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("price_multiplier" as keyof Province)}>Multiplier{SortIcon("price_multiplier", String(sortField), sortDir)}</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedProvinces.map((p) => (
                <tr key={p.code} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.code}</td>
                  {editingCode === p.code ? (
                    <>
                      <td className="px-4 py-2">
                        <input type="text" value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-300" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="text" value={editForm.island_group}
                          onChange={(e) => setEditForm((f) => ({ ...f, island_group: e.target.value }))}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-300" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" step="0.01" min="0" value={editForm.price_multiplier}
                          onChange={(e) => setEditForm((f) => ({ ...f, price_multiplier: e.target.value }))}
                          className="w-24 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-300" />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleSave(p.code)} disabled={saving}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Simpan">
                            {saving ? <div className="w-4 h-4 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
                              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </button>
                          <button onClick={cancelEdit}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Batal">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                      <td className="px-4 py-3 text-gray-600">{p.island_group}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-semibold text-primary-600">{p.price_multiplier.toFixed(2)}x</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => startEdit(p)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
          <Pagination page={page} totalPages={totalPages} totalItems={totalItems} hasPrev={hasPrev} hasNext={hasNext} onPrev={prevPage} onNext={nextPage} />
        </div>
      </div>
    </div>
  );
}

/* ─── Tab: Kota ─── */

function CitiesTab() {
  const [cities, setCities] = useState<AdminCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", province_code: "", province_name: "", is_jabodetabek: false, price_tier: "medium", latitude: "", longitude: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.adminGetCities(100000);
      setCities(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat kota");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProvinces = useCallback(async () => {
    try {
      const res = await api.adminGetProvinces();
      setProvinces(res.items);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchData(); fetchProvinces(); }, [fetchData, fetchProvinces]);

  const { sorted: sortedCities, sortField, sortDir, toggleSort, limit, setLimit, page, totalPages, totalItems, nextPage, prevPage, hasNext, hasPrev } = useSortable(cities, "name" as keyof AdminCity);

  function resetForm() {
    setForm({ name: "", province_code: "", province_name: "", is_jabodetabek: false, price_tier: "medium", latitude: "", longitude: "" });
    setFormError(null);
    setEditId(null);
  }

  function openCreate() {
    resetForm();
    setShowModal(true);
  }

  function openEdit(c: AdminCity) {
    setEditId(c.id);
    setForm({
      name: c.name,
      province_code: c.province_code,
      province_name: c.province_name || "",
      is_jabodetabek: c.is_jabodetabek,
      price_tier: c.price_tier,
      latitude: c.latitude !== null ? String(c.latitude) : "",
      longitude: c.longitude !== null ? String(c.longitude) : "",
    });
    setFormError(null);
    setShowModal(true);
  }

  function closeModal() { setShowModal(false); resetForm(); }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const body = {
        name: form.name.trim(),
        province_code: form.province_code,
        province_name: form.province_name.trim() || undefined,
        is_jabodetabek: form.is_jabodetabek,
        price_tier: form.price_tier,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      };
      if (editId !== null) {
        await api.adminUpdateCity(editId, body);
      } else {
        await api.adminCreateCity(body as CityCreate);
      }
      closeModal();
      await fetchData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeleting(true);
    try {
      await api.adminDeleteCity(id);
      setDeleteId(null);
      await fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div className="bg-white rounded-xl border border-gray-200 p-12 text-center"><div className="inline-block w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-3" /><p className="text-sm text-gray-400">Memuat kota...</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">{cities.length} total kota</p>
        <button onClick={openCreate}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors shadow-sm flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Tambah Kota
        </button>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">{error}</div>}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="flex items-center justify-end px-4 py-2 border-b border-gray-100">
          <LimitSelector limit={limit} onChange={setLimit} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("id" as keyof AdminCity)}>ID{SortIcon("id", String(sortField), sortDir)}</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("name" as keyof AdminCity)}>Nama Kota{SortIcon("name", String(sortField), sortDir)}</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("province_name" as keyof AdminCity)}>Provinsi{SortIcon("province_name", String(sortField), sortDir)}</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("is_jabodetabek" as keyof AdminCity)}>Jabodetabek{SortIcon("is_jabodetabek", String(sortField), sortDir)}</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("price_tier" as keyof AdminCity)}>Price Tier{SortIcon("price_tier", String(sortField), sortDir)}</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("latitude" as keyof AdminCity)}>Lat{SortIcon("latitude", String(sortField), sortDir)}</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("longitude" as keyof AdminCity)}>Lng{SortIcon("longitude", String(sortField), sortDir)}</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedCities.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">Belum ada data kota.</td></tr>
              ) : (
                sortedCities.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.province_name || c.province_code}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${c.is_jabodetabek ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"}`}>
                        {c.is_jabodetabek ? "✓" : "✗"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs capitalize text-gray-500">{c.price_tier}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{c.latitude ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{c.longitude ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => setDeleteId(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
          <Pagination page={page} totalPages={totalPages} totalItems={totalItems} hasPrev={hasPrev} hasNext={hasNext} onPrev={prevPage} onNext={nextPage} />
        </div>
      </div>

      {/* Modal: Create / Edit City */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{editId !== null ? "Edit Kota" : "Tambah Kota"}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{editId !== null ? `Mengedit ID #${editId}` : "Isi detail kota baru"}</p>
              </div>
              <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="px-6 py-4 space-y-4">
              {formError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{formError}</div>}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Nama Kota <span className="text-red-400">*</span></label>
                <input type="text" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500" placeholder="Jakarta" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Kode Provinsi <span className="text-red-400">*</span></label>
                <div className="flex gap-2">
                  <select required value={form.province_code} onChange={(e) => setForm((f) => ({ ...f, province_code: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 bg-white">
                    <option value="">Pilih provinsi</option>
                    {provinces.map((p) => (<option key={p.code} value={p.code}>{p.code} - {p.name}</option>))}
                  </select>
                  <input type="text" value={form.province_name} onChange={(e) => setForm((f) => ({ ...f, province_name: e.target.value }))}
                    className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500" placeholder="Nama provinsi (opsional)" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Price Tier <span className="text-red-400">*</span></label>
                  <select required value={form.price_tier} onChange={(e) => setForm((f) => ({ ...f, price_tier: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 bg-white">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="flex items-center pt-6">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={form.is_jabodetabek} onChange={(e) => setForm((f) => ({ ...f, is_jabodetabek: e.target.checked }))} className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600" />
                  </label>
                  <span className="ml-3 text-sm text-gray-700 font-medium">Jabodetabek</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Latitude</label>
                  <input type="number" step="any" value={form.latitude} onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500" placeholder="-6.2088" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Longitude</label>
                  <input type="number" step="any" value={form.longitude} onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500" placeholder="106.8456" />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100 mt-6">
                <button type="button" onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">Batal</button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm flex items-center gap-2">
                  {saving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                    : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {editId !== null ? "Perbarui" : "Simpan"}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation City */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 pt-6 pb-2">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-center text-gray-800">Hapus Kota</h3>
              <p className="text-sm text-gray-500 text-center mt-1">Apakah kamu yakin ingin menghapus kota ini?<br />Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="px-6 pb-6 pt-4 flex gap-3">
              <button onClick={() => setDeleteId(null)} disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200">Batal</button>
              <button onClick={() => handleDelete(deleteId)} disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 rounded-lg transition-colors flex items-center justify-center gap-2">
                {deleting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menghapus...</> : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tab: Override ─── */

function OverridesTab() {
  const [overrides, setOverrides] = useState<PriceOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: "", price_multiplier: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.adminGetOverrides();
      setOverrides(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat override");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { sorted: sortedOverrides, sortField, sortDir, toggleSort, limit, setLimit, page, totalPages, totalItems, nextPage, prevPage, hasNext, hasPrev } = useSortable(overrides, "code" as keyof PriceOverride);

  function startEdit(o: PriceOverride) {
    setEditingCode(o.code);
    setEditForm({ label: o.label, price_multiplier: String(o.price_multiplier) });
  }

  function cancelEdit() { setEditingCode(null); }

  async function handleSave(code: string) {
    setSaving(true);
    try {
      await api.adminUpdateOverride(code, {
        label: editForm.label.trim(),
        price_multiplier: parseFloat(editForm.price_multiplier) || 1.0,
      });
      setEditingCode(null);
      await fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="bg-white rounded-xl border border-gray-200 p-12 text-center"><div className="inline-block w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-3" /><p className="text-sm text-gray-400">Memuat override...</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">{overrides.length} total override harga</p>
        <button onClick={fetchData} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg> Refresh
        </button>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">{error}</div>}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="flex items-center justify-end px-4 py-2 border-b border-gray-100">
          <LimitSelector limit={limit} onChange={setLimit} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("code" as keyof PriceOverride)}>Kode{SortIcon("code", String(sortField), sortDir)}</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("label" as keyof PriceOverride)}>Label{SortIcon("label", String(sortField), sortDir)}</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("price_multiplier" as keyof PriceOverride)}>Multiplier{SortIcon("price_multiplier", String(sortField), sortDir)}</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("member_provinces" as keyof PriceOverride)}>Member Provinsi{SortIcon("member_provinces", String(sortField), sortDir)}</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedOverrides.map((o) => (
                <tr key={o.code} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{o.code}</td>
                  {editingCode === o.code ? (
                    <>
                      <td className="px-4 py-2">
                        <input type="text" value={editForm.label}
                          onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-300" />
                      </td>
                      <td className="px-4 py-2">
                        <input type="number" step="0.01" min="0" value={editForm.price_multiplier}
                          onChange={(e) => setEditForm((f) => ({ ...f, price_multiplier: e.target.value }))}
                          className="w-24 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-300" />
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400">{o.member_provinces}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleSave(o.code)} disabled={saving}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Simpan">
                            {saving ? <div className="w-4 h-4 border-2 border-green-300 border-t-green-600 rounded-full animate-spin" />
                              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                          </button>
                          <button onClick={cancelEdit}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Batal">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-gray-800">{o.label}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm font-semibold text-primary-600">{o.price_multiplier.toFixed(2)}x</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{o.member_provinces}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => startEdit(o)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
          <Pagination page={page} totalPages={totalPages} totalItems={totalItems} hasPrev={hasPrev} hasNext={hasNext} onPrev={prevPage} onNext={nextPage} />
        </div>
      </div>
    </div>
  );
}

/* ─── Tab: Users ─── */

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.adminGetUsers();
      setUsers(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { sorted: sortedUsers, sortField, sortDir, toggleSort, limit, setLimit, page, totalPages, totalItems, nextPage, prevPage, hasNext, hasPrev } = useSortable(users, "email" as keyof AdminUser);

  async function handleRoleChange(userId: number, newRole: string) {
    setChangingRole(userId);
    try {
      await api.adminUpdateUserRole(userId, newRole);
      await fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal mengubah role");
    } finally {
      setChangingRole(null);
    }
  }

  async function handleDelete(id: number) {
    setDeleting(true);
    try {
      await api.adminDeleteUser(id);
      setDeleteId(null);
      await fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal menghapus user");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div className="bg-white rounded-xl border border-gray-200 p-12 text-center"><div className="inline-block w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-3" /><p className="text-sm text-gray-400">Memuat users...</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">{users.length} total pengguna</p>
        <button onClick={fetchData} className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg> Refresh
        </button>
      </div>
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">{error}</div>}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="flex items-center justify-end px-4 py-2 border-b border-gray-100">
          <LimitSelector limit={limit} onChange={setLimit} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("id" as keyof AdminUser)}>ID{SortIcon("id", String(sortField), sortDir)}</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("email" as keyof AdminUser)}>Email{SortIcon("email", String(sortField), sortDir)}</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("display_name" as keyof AdminUser)}>Nama{SortIcon("display_name", String(sortField), sortDir)}</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("role" as keyof AdminUser)}>Role{SortIcon("role", String(sortField), sortDir)}</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("email_verified" as keyof AdminUser)}>Verified{SortIcon("email_verified", String(sortField), sortDir)}</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider cursor-pointer select-none hover:text-primary-600" onClick={() => toggleSort("has_preferences" as keyof AdminUser)}>Prefs{SortIcon("has_preferences", String(sortField), sortDir)}</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedUsers.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Belum ada pengguna.</td></tr>
              ) : (
                sortedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{u.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{u.email}</td>
                    <td className="px-4 py-3 text-gray-600">{u.display_name || "—"}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        disabled={changingRole === u.id}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded border focus:outline-none focus:ring-1 focus:ring-primary-300 ${
                          u.role === "admin" ? "bg-purple-50 border-purple-200 text-purple-700 font-semibold" : "bg-gray-50 border-gray-200 text-gray-600"
                        }`}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${u.email_verified ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600"}`}>
                        {u.email_verified ? "✓" : "!"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${u.has_preferences ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                        {u.has_preferences ? "✓" : "✗"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setDeleteId(u.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus User">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-3">
          <Pagination page={page} totalPages={totalPages} totalItems={totalItems} hasPrev={hasPrev} hasNext={hasNext} onPrev={prevPage} onNext={nextPage} />
        </div>
      </div>

      {/* Delete Confirmation User */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 pt-6 pb-2">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-center text-gray-800">Hapus Pengguna</h3>
              <p className="text-sm text-gray-500 text-center mt-1">Apakah kamu yakin ingin menghapus user ini?<br />Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="px-6 pb-6 pt-4 flex gap-3">
              <button onClick={() => setDeleteId(null)} disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200">Batal</button>
              <button onClick={() => handleDelete(deleteId)} disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 rounded-lg transition-colors flex items-center justify-center gap-2">
                {deleting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menghapus...</> : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Component ─── */

export default function AdminPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isCheckingAuth } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabKey>("makanan");

  /* Auth guard */
  useEffect(() => {
    if (isCheckingAuth) return;
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    if (user?.role !== "admin") {
      navigate("/");
      return;
    }
  }, [isCheckingAuth, isAuthenticated, user, navigate]);

  if (isCheckingAuth) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="text-center text-gray-400 py-12">Memeriksa akses...</div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "admin") {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-800 mb-4">👑 Admin Panel</h1>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab.key
                ? "bg-primary-600 text-white shadow-sm"
                : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "makanan" && <FoodsTab />}
      {activeTab === "provinsi" && <ProvincesTab />}
      {activeTab === "kota" && <CitiesTab />}
      {activeTab === "override" && <OverridesTab />}
      {activeTab === "users" && <UsersTab />}
    </div>
  );
}