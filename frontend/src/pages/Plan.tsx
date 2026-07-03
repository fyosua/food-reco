import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { api, type PlanResponse, type Condition } from "../lib/api";
import FoodCard from "../components/FoodCard";
import ChatPanel from "../components/ChatPanel";
import CitySearch from "../components/CitySearch";
import MacroBadge from "../components/MacroBadge";

export default function PlanPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [conditions, setConditions] = useState<Condition[]>([]);
  const [selectedCondition, setSelectedCondition] = useState("none");
  const [selectedSex, setSelectedSex] = useState("male");
  const [selectedCity, setSelectedCity] = useState<{ id: number; name: string } | null>(null);
  const [ageGroup, setAgeGroup] = useState("adult");

  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isChatSending, setIsChatSending] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Check auth and load conditions
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    api.getConditions().then((res) => {
      setConditions(res.conditions);
    }).catch(() => {});
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
      const result = await api.generatePlan({
        condition: selectedCondition,
        sex: selectedSex,
        city_id: selectedCity.id,
        age_group: ageGroup,
      });
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
            rating === 1 ? "👍 Suka! Kami akan sesuaikan." : "👎 Catatan, akan kami perhatikan."
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

      {/* ── Controls ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Condition */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Kondisi
            </label>
            <select
              value={selectedCondition}
              onChange={(e) => setSelectedCondition(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {conditions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
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
              <span className="text-sm text-gray-400">
                {plan.plan_id}
              </span>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="bg-primary-50 text-primary-700 px-3 py-1.5 rounded-lg">
                Total:{" "}
                <strong>
                  Rp {(plan.budget?.total_cost_idr as number)?.toLocaleString("id-ID") || "—"}
                </strong>
              </div>
              <div className="bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg">
                Kalori:{" "}
                <strong>{Math.round(totalCalories || 0)} kcal</strong>
              </div>
              <div className="bg-green-50 text-green-700 px-3 py-1.5 rounded-lg">
                Protein:{" "}
                <strong>{Math.round(totalProtein || 0)}g</strong>
              </div>
              {plan.notes && (
                <div className="text-gray-500 text-xs italic">
                  {plan.notes}
                </div>
              )}
            </div>
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
                  const colorMap: Record<string, "orange" | "green" | "blue" | "purple"> = {
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
      {!plan && !isLoading && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">🍽️</div>
          <h2 className="text-xl font-bold text-gray-700 mb-2">
            Belum ada rencana
          </h2>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Pilih kota dan preferensi di atas, lalu klik "Buat Rencana Makan" untuk
            mendapatkan rekomendasi menu harian yang dipersonalisasi.
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