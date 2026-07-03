import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { api, type PlanResponse, type Condition, type UserPrefs, type City } from "../lib/api";
import FoodCard from "../components/FoodCard";
import ChatPanel from "../components/ChatPanel";
import CitySearch from "../components/CitySearch";
import MacroBadge from "../components/MacroBadge";

export default function PlanPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [conditions, setConditions] = useState<Condition[]>([]);
  const [selectedConditions, setSelectedConditions] = useState<string[]>(["none"]);
  const [selectedSex, setSelectedSex] = useState("male");
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [ageGroup, setAgeGroup] = useState("adult");
  const [dailyBudget, setDailyBudget] = useState<string>("");

  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChatSending, setIsChatSending] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Preference state
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // Auto-deselect conditions that no longer apply when sex changes
  useEffect(() => {
    setSelectedConditions((prev) =>
      prev.filter((cId) => {
        const cond = conditions.find((c) => c.id === cId) as { id: string; label: string; sex?: string | null } | undefined;
        if (!cond || !cond.sex) return true;
        return cond.sex === selectedSex;
      })
    );
  }, [selectedSex, conditions]);

  // Check auth and load conditions + preferences
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    const loadData = async () => {
      try {
        const [condRes, userPrefs] = await Promise.all([
          api.getConditions(),
          api.getPreferences().catch(() => null),
        ]);
        setConditions(condRes.conditions);

        if (userPrefs) {
          setPrefs(userPrefs);
          // Check if user has actual preferences (not just empty defaults)
          const hasRealPrefs =
            (userPrefs.default_conditions && userPrefs.default_conditions.length > 0) ||
            !!userPrefs.default_sex ||
            userPrefs.default_city_id != null ||
            userPrefs.daily_budget_idr != null ||
            userPrefs.per_meal_budget_idr != null ||
            userPrefs.variety_appetite != null ||
            userPrefs.prep_lean != null ||
            (userPrefs.exclusions_json && userPrefs.exclusions_json.length > 0);

          // Pre-fill conditions (only if user has real prefs)
          if (hasRealPrefs && userPrefs.default_conditions && userPrefs.default_conditions.length > 0) {
            setSelectedConditions(userPrefs.default_conditions);
          } else {
            setSelectedConditions(["none"]);
          }

          // Pre-fill sex (only if user has real prefs)
          if (hasRealPrefs && userPrefs.default_sex) {
            setSelectedSex(userPrefs.default_sex);
          }

          // Pre-fill daily budget (only if user has real prefs)
          if (hasRealPrefs && userPrefs.daily_budget_idr != null) {
            setDailyBudget(String(userPrefs.daily_budget_idr));
          }

          // Look up city by default_city_id (only if user has real prefs)
          if (hasRealPrefs && userPrefs.default_city_id != null) {
            try {
              const cities = await api.searchCities("", 1000);
              const match = cities.find(
                (c) => c.id === userPrefs.default_city_id
              );
              if (match) {
                setSelectedCity(match);
              }
            } catch {
              // city lookup failed, ignore
            }
          }
        }
      } catch {
        // silent
      } finally {
        setPrefsLoaded(true);
      }
    };

    loadData();
  }, [isAuthenticated, navigate]);

  const generatePlan = async () => {
    if (!selectedCity) {
      setError("Pilih kota terlebih dahulu");
      return;
    }
    setIsLoading(true);
    setError("");
    setPlan(null);

    try {
      const budgetValue = dailyBudget
        ? parseInt(dailyBudget.replace(/[^0-9]/g, ""), 10)
        : undefined;

      const body = {
        conditions: selectedConditions,
        sex: selectedSex,
        city_id: selectedCity.id,
        age_group: ageGroup,
        ...(budgetValue && budgetValue > 0 ? { daily_budget_idr: budgetValue } : {}),
      } as Parameters<typeof api.generatePlan>[0];

      const result = await api.generatePlan(body);
      setPlan(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal membuat rencana";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRate = async (foodItemId: number, rating: number) => {
    try {
      const result = await api.submitFeedback(
        foodItemId,
        rating,
        plan?.plan_id
      );
      if (result.learning) {
        const actions = (result.learning as { actions?: unknown[] }).actions;
        if (actions && actions.length > 0) {
          setSuccessMsg(
            rating === 1
              ? "👍 Suka! Kami akan sesuaikan."
              : "👎 Catatan, akan kami perhatikan."
          );
          setTimeout(() => setSuccessMsg(""), 3000);
        }
      }
    } catch {
      // silent
    }
  };

  const handleChat = async (message: string) => {
    if (!plan) return;
    setIsChatSending(true);
    try {
      const result = await api.chatAdjust(plan.plan_id, message);
      setPlan(result);
    } catch {
      // silent
    } finally {
      setIsChatSending(false);
    }
  };

  // Build preferences from plan
  const totalCalories = plan?.meals.reduce(
    (sum, m) => sum + (m.nutrition.calories || 0),
    0
  );

  const totalProtein = plan?.meals.reduce(
    (sum, m) => sum + (m.nutrition.protein_g || 0),
    0
  );

  // User has real preferences if they have at least one meaningful field filled
  const hasPrefs = (() => {
    if (!prefs) return false;
    return (
      (prefs.default_conditions && prefs.default_conditions.length > 0) ||
      !!prefs.default_sex ||
      prefs.default_city_id != null ||
      prefs.daily_budget_idr != null ||
      prefs.per_meal_budget_idr != null ||
      prefs.variety_appetite != null ||
      prefs.prep_lean != null ||
      (prefs.exclusions_json && prefs.exclusions_json.length > 0)
    );
  })();

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* ── User greeting ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          Halo, {user?.email?.split("@")[0] || "Pengguna"}! 👋
        </h1>
        <p className="text-gray-500 text-sm">
          Atur preferensi dan dapatkan rencana makan harian
        </p>
      </div>

      {/* ── Preferences status ── */}
      {prefsLoaded &&
        (hasPrefs ? (
          <div className="mb-4 flex items-center gap-2">
            <Link
              to="/preferences"
              className="inline-flex items-center gap-1.5 bg-primary-50 border border-primary-200 text-primary-700 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-primary-100 transition"
            >
              <span>✅</span>
              <span>Prefensi terisi</span>
              <span className="text-primary-400">&rarr;</span>
            </Link>
          </div>
        ) : (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-amber-800">
              Atur preferensi makananmu untuk rekomendasi yang lebih personal!
            </p>
            <Link
              to="/preferences"
              className="shrink-0 bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-amber-700 transition"
            >
              Isi Preferensi &rarr;
            </Link>
          </div>
        ))}

      {/* ── Controls ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Conditions (multi-select) */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Kondisi Kesehatan
            </label>
            <div className="flex flex-wrap gap-1.5">
              {conditions
                .filter((c: { id: string; label: string; sex?: string | null }) => {
                  if (!c.sex) return true;
                  return c.sex === selectedSex;
                })
                .map((c) => {
                  const isSelected = selectedConditions.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedConditions((prev) =>
                          isSelected
                            ? prev.filter((x) => x !== c.id)
                            : [...prev.filter((x) => x !== "none"), c.id]
                        );
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                        isSelected
                          ? "bg-primary-100 border-primary-300 text-primary-700"
                          : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      {c.label}
                      {isSelected && <span className="ml-1">&times;</span>}
                    </button>
                  );
                })}
            </div>
            {selectedConditions.length === 0 && (
              <p className="text-xs text-gray-400 mt-1 italic">
                Tidak ada kondisi khusus
              </p>
            )}
          </div>

          {/* Sex */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Jenis Kelamin
            </label>
            <select
              value={selectedSex}
              onChange={(e) => setSelectedSex(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="male">Laki-laki</option>
              <option value="female">Perempuan</option>
            </select>
          </div>

          {/* Age group */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Usia
            </label>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="adult">Dewasa</option>
              <option value="teen">Remaja</option>
              <option value="elderly">Lansia</option>
            </select>
          </div>

          {/* City */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Kota
            </label>
            <CitySearch
              value={selectedCity?.id ?? null}
              onChange={(c) => setSelectedCity(c)}
              placeholder="Cari kota..."
            />
          </div>

          {/* Daily budget */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Budget Harian (Rp)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={dailyBudget}
                onChange={(e) => {
                  // Only allow digits
                  const cleaned = e.target.value.replace(/[^0-9]/g, "");
                  setDailyBudget(cleaned ? Number(cleaned).toLocaleString("id-ID") : "");
                }}
                placeholder="0"
                className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          onClick={generatePlan}
          disabled={isLoading || !selectedCity}
          className="mt-4 w-full bg-primary-600 text-white py-3 rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50 text-sm"
        >
          {isLoading
            ? "Membuat rencana..."
            : "🎯 Buat Rencana Makan Hari Ini"}
        </button>
      </div>

      {/* ── Success toast ── */}
      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-lg text-sm text-center">
          {successMsg}
        </div>
      )}

      {/* ── Plan results ── */}
      {plan && (
        <>
          {/* Budget summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-800">
                📋 Rencana Harian
              </h2>
              <span className="text-sm text-gray-400">{plan.plan_id}</span>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="bg-primary-50 text-primary-700 px-3 py-1.5 rounded-lg">
                Total:{" "}
                <strong>
                  Rp{" "}
                  {(plan.budget?.total_cost_idr as number)?.toLocaleString(
                    "id-ID"
                  ) || "—"}
                </strong>
              </div>
              <div className="bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg">
                Kalori: <strong>{Math.round(totalCalories || 0)} kcal</strong>
              </div>
              <div className="bg-green-50 text-green-700 px-3 py-1.5 rounded-lg">
                Protein: <strong>{Math.round(totalProtein || 0)}g</strong>
              </div>
              {plan.notes && (
                <div className="text-gray-500 text-xs italic">
                  {plan.notes}
                </div>
              )}
            </div>
          </div>

          {/* ── Sesuaikan Rencana sticker ── */}
          <div className="mb-4 bg-gradient-to-r from-primary-50 to-amber-50 border border-primary-200 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-2xl">✏️</div>
              <div>
                <p className="text-sm font-semibold text-primary-800">
                  Belum cocok? Sesuaikan rencana ini
                </p>
                <p className="text-xs text-primary-600 mt-0.5">
                  Ganti lauk, bikin lebih pedas, atau minta menu lain — tinggal chat
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                // Dispatch a custom event to open the chat panel
                const event = new CustomEvent("open-chat");
                window.dispatchEvent(event);
              }}
              className="shrink-0 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm flex items-center gap-1.5"
            >
              <span>💬</span>
              Sesuaikan
            </button>
          </div>

          {/* Meal cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plan.meals.map((meal, i) => (
              <FoodCard key={`${meal.slot}-${i}`} meal={meal} onRate={handleRate} />
            ))}
          </div>

          {/* Macro targets */}
          {plan.macro_targets && Object.keys(plan.macro_targets).length > 0 && (
            <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                Target Nutrisi Harian
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(plan.macro_targets).map(([key, value]) => {
                  const unitMap: Record<string, string> = {
                    calories: "kcal",
                    protein_g: "g",
                    carbs_g: "g",
                    fat_g: "g",
                    fiber_g: "g",
                  };
                  const colorMap: Record<
                    string,
                    "orange" | "green" | "blue" | "purple"
                  > = {
                    calories: "orange",
                    protein_g: "green",
                    carbs_g: "blue",
                    fat_g: "purple",
                    fiber_g: "green",
                  };
                  const labelMap: Record<string, string> = {
                    calories: "Kalori",
                    protein_g: "Protein",
                    carbs_g: "Karbohidrat",
                    fat_g: "Lemak",
                    fiber_g: "Serat",
                  };
                  return (
                    <MacroBadge
                      key={key}
                      label={labelMap[key] || key}
                      value={Math.round(value)}
                      unit={unitMap[key] || ""}
                      color={colorMap[key] || "gray"}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Empty state ── */}
      {!plan && isLoading && (
        <div className="space-y-4 py-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="flex items-start justify-between mb-3">
                <div className="h-5 bg-gray-200 rounded w-28" />
                <div className="h-5 bg-gray-200 rounded w-20" />
              </div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
              <div className="flex gap-2 mb-3">
                <div className="h-6 bg-gray-200 rounded w-16" />
                <div className="h-6 bg-gray-200 rounded w-16" />
                <div className="h-6 bg-gray-200 rounded w-16" />
              </div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2" />
              <div className="h-4 bg-gray-200 rounded w-5/6" />
            </div>
          ))}
          <p className="text-center text-sm text-gray-400 animate-pulse">
            Menyusun rekomendasi menu terbaik untukmu...
          </p>
        </div>
      )}

      {!plan && !isLoading && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🍽️</div>
          <h2 className="text-xl font-bold text-gray-700 mb-2">
            Belum ada rencana
          </h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Pilih kota dan preferensi di atas, lalu klik "Buat Rencana Makan"
            untuk mendapatkan rekomendasi menu harian yang dipersonalisasi.
          </p>
        </div>
      )}

      {/* ── Chat panel ── */}
      <ChatPanel
        planId={plan?.plan_id ?? null}
        onSendMessage={handleChat}
        isSending={isChatSending}
      />
    </div>
  );
}