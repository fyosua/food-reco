import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { api, type HistoryEntry } from "../lib/api";

// ── Constants ──

const slotIcons: Record<string, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍪",
};

const slotLabels: Record<string, string> = {
  breakfast: "Sarapan",
  lunch: "Makan Siang",
  dinner: "Makan Malam",
  snack: "Camilan",
};

const slotBorderColors: Record<string, string> = {
  breakfast: "border-l-yellow-400",
  lunch: "border-l-orange-500",
  dinner: "border-l-purple-500",
  snack: "border-l-blue-400",
};

const categoryColors: Record<string, string> = {
  sayur: "bg-green-100 text-green-700",
  buah: "bg-red-100 text-red-700",
  protein: "bg-orange-100 text-orange-700",
  karbohidrat: "bg-blue-100 text-blue-700",
  lauk: "bg-yellow-100 text-yellow-700",
  snack: "bg-pink-100 text-pink-700",
  minuman: "bg-cyan-100 text-cyan-700",
};

function getCategoryBadge(category: string | null): string {
  if (!category) return "bg-gray-100 text-gray-500";
  const key = category.toLowerCase();
  for (const [prefix, cls] of Object.entries(categoryColors)) {
    if (key.includes(prefix)) return cls;
  }
  return "bg-gray-100 text-gray-600";
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const d = date.toDateString();
  const t = today.toDateString();
  const y = yesterday.toDateString();

  if (d === t) return "Hari Ini";
  if (d === y) return "Kemarin";

  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateKey(dateStr: string): string {
  return dateStr.slice(0, 10); // YYYY-MM-DD
}

function formatPrice(val: number | null): string {
  if (val === null || val === undefined) return "";
  return "Rp " + val.toLocaleString("id-ID");
}

function parseTags(val: string | null): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

// ── MacroBadge inline ──

function MacroBadge({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  const colorMap: Record<string, string> = {
    orange: "bg-orange-50 text-orange-700",
    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
    purple: "bg-purple-50 text-purple-700",
    gray: "bg-gray-50 text-gray-600",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[color] || colorMap.gray}`}>
      <span className="font-semibold">{Math.round(value)}</span>
      {unit && <span>{unit}</span>}
      <span className="opacity-70">{label}</span>
    </span>
  );
}

// ── HistoryFoodCard (inline FoodCard for history) ──

function HistoryFoodCard({
  entry,
  onRate,
  ratedMap,
}: {
  entry: HistoryEntry;
  onRate: (foodItemId: number, rating: number) => void;
  ratedMap: Record<number, number>;
}) {
  const [expanded, setExpanded] = useState(false);
  const borderColor = slotBorderColors[entry.slot] || "border-l-gray-400";

  const tags = parseTags(entry.tags_json);

  return (
    <div
      className={`border-l-4 ${borderColor} transition hover:bg-gray-50`}
    >
      {/* Collapsed row */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl flex-shrink-0 mt-0.5">
            {slotIcons[entry.slot] || "🍽️"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-800 truncate">
                {entry.food_name || `Makanan #${entry.food_item_id}`}
              </h3>
              {entry.food_category && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${getCategoryBadge(entry.food_category)}`}>
                  {entry.food_category}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
              <span className="font-medium text-gray-500">
                {slotLabels[entry.slot] || entry.slot}
              </span>
              <span>•</span>
              <span>{formatTime(entry.served_at)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              {entry.calories != null && (
                <div className="flex items-center gap-1 text-sm">
                  <span className="text-orange-500 font-medium">{Math.round(entry.calories)}</span>
                  <span className="text-gray-400">kcal</span>
                </div>
              )}
              {/* Rating buttons always visible */}
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-xs text-gray-400">Suka?</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onRate(entry.food_item_id, 1); }}
                  className={`px-2 py-0.5 rounded-full text-xs transition ${
                    ratedMap[entry.food_item_id] === 1
                      ? "bg-green-100 text-green-700 border border-green-300"
                      : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-green-50"
                  }`}
                >
                  👍
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onRate(entry.food_item_id, -1); }}
                  className={`px-2 py-0.5 rounded-full text-xs transition ${
                    ratedMap[entry.food_item_id] === -1
                      ? "bg-red-100 text-red-700 border border-red-300"
                      : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-red-50"
                  }`}
                >
                  👎
                </button>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="ml-2 text-xs text-primary-500 hover:text-primary-700 font-medium"
                >
                  {expanded ? "Sembunyikan" : "Detail"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded nutrition details (like FoodCard) */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3 ml-4">
          {/* Macro badges */}
          <div className="flex flex-wrap gap-1.5">
            {entry.calories != null && <MacroBadge label="Kal" value={Math.round(entry.calories)} unit="" color="orange" />}
            {entry.protein_g != null && <MacroBadge label="Protein" value={Math.round(entry.protein_g)} unit="g" color="green" />}
            {entry.carbs_g != null && <MacroBadge label="Karbo" value={Math.round(entry.carbs_g)} unit="g" color="blue" />}
            {entry.fat_g != null && <MacroBadge label="Lemak" value={Math.round(entry.fat_g)} unit="g" color="purple" />}
            {entry.fiber_g != null && <MacroBadge label="Serat" value={Math.round(entry.fiber_g)} unit="g" color="green" />}
          </div>

          {/* Price */}
          {entry.price_pasar_min != null && (
            <p className="text-sm text-gray-700">
              <span className="text-gray-400">Harga: </span>
              <span className="font-semibold text-primary-700">{formatPrice(entry.price_pasar_min)}</span>
              {entry.prep_type === "buy_ready" ? " (Beli Jadi)" : entry.prep_type === "simple_cook" ? " (Masak Simple)" : ""}
            </p>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span key={tag} className="text-[10px] bg-primary-50 text-primary-600 px-1.5 py-0.5 rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Condition */}
          {entry.condition && (
            <div className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full inline-flex">
              🏷️ {entry.condition}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Component ──

export default function HistoryPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [ratedMap, setRatedMap] = useState<Record<number, number>>({});
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    api
      .getHistory()
      .then((entries) => {
        setHistory(entries);
        // Auto-expand newest date
        if (entries.length > 0) {
          const dates = [...new Set(entries.map((e) => formatDateKey(e.served_at)))].sort().reverse();
          if (dates.length > 0) {
            setExpandedDates(new Set([dates[0]!]));
          }
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [isAuthenticated, navigate]);

  // Group by date, then by plan_id within each date
  const grouped = useMemo(() => {
    // First group by date
    const dateGroups: Record<string, HistoryEntry[]> = {};
    for (const entry of history) {
      const key = formatDateKey(entry.served_at);
      if (!dateGroups[key]) dateGroups[key] = [];
      dateGroups[key].push(entry);
    }

    // For each date, sub-group by plan_id
    const result: Array<[string, Array<{ planId: string; planTime: string; entries: HistoryEntry[] }>]> = [];

    for (const [dateKey, entries] of Object.entries(dateGroups)) {
      // Sort entries by served_at ascending within the date
      entries.sort(
        (a, b) => new Date(a.served_at).getTime() - new Date(b.served_at).getTime()
      );

      // Sub-group by plan_id
      const planMap = new Map<string, HistoryEntry[]>();
      for (const entry of entries) {
        const pid = entry.plan_id || "unknown";
        if (!planMap.has(pid)) planMap.set(pid, []);
        planMap.get(pid)!.push(entry);
      }

      // Convert plan groups to sorted array (by first entry's time)
      const planGroups = Array.from(planMap.entries()).map(([planId, planEntries]) => ({
        planId,
        planTime: planEntries[0]!.served_at,
        entries: planEntries,
      }));
      planGroups.sort((a, b) => new Date(a.planTime).getTime() - new Date(b.planTime).getTime());

      result.push([dateKey, planGroups]);
    }

    // Sort dates descending
    result.sort(([a], [b]) => b.localeCompare(a));
    return result;
  }, [history]);

  const toggleDate = (dateKey: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  const handleRate = async (foodItemId: number, rating: number) => {
    try {
      // Optimistic update
      setRatedMap((prev) => ({ ...prev, [foodItemId]: rating }));
      const result = await api.submitFeedback(foodItemId, rating);
      if (result.learning) {
        setSuccessMsg(
          rating === 1
            ? "👍 Suka! Kami akan sesuaikan."
            : "👎 Catatan, akan kami perhatikan."
        );
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch {
      // Revert on failure
      setRatedMap((prev) => {
        const next = { ...prev };
        delete next[foodItemId];
        return next;
      });
    }
  };

  // ── Loading ──

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">📜 Riwayat Makan</h1>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded-lg w-48 mb-3" />
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-200 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Empty ──

  if (history.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">📜 Riwayat Makan</h1>
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🍽️</div>
          <h2 className="text-lg font-bold text-gray-700 mb-2">Belum ada riwayat</h2>
          <p className="text-gray-400 text-sm">
            Rencana makan akan muncul di sini setelah kamu membuatnya.
          </p>
        </div>
      </div>
    );
  }

  // ── Main ──

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📜 Riwayat Makan</h1>

      {/* Success toast */}
      {successMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-lg text-sm text-center">
          {successMsg}
        </div>
      )}

      <div className="space-y-4">
        {grouped.map(([dateKey, planGroups]) => {
                  const isOpen = expandedDates.has(dateKey);
                  const totalCalories = planGroups.reduce(
                    (sum, pg) => sum + pg.entries.reduce((s, e) => s + (e.calories ?? 0), 0),
                    0
                  );
                  const totalItems = planGroups.reduce((sum, pg) => sum + pg.entries.length, 0);

                  return (
                    <div key={dateKey} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      {/* Date header — clickable */}
                      <button
                        onClick={() => toggleDate(dateKey)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-semibold text-gray-800">
                            {formatDateLabel(dateKey)}
                          </span>
                          <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                            {totalItems} makanan{planGroups.length > 1 ? ` (${planGroups.length} rencana)` : ""}
                          </span>
                          {totalCalories > 0 && (
                            <span className="text-xs text-gray-400 hidden sm:inline">
                              ~{Math.round(totalCalories)} kcal
                            </span>
                          )}
                        </div>
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>

                      {/* Entries grouped by plan */}
                      {isOpen && (
                        <div className="divide-y divide-gray-100">
                          {planGroups.map((planGroup, pgIdx) => (
                            <div key={planGroup.planId}>
                              {/* Plan separator header */}
                              <div className="px-4 py-2 bg-primary-50/50 border-b border-primary-100 flex items-center gap-2">
                                <span className="text-xs font-semibold text-primary-700 uppercase tracking-wide">
                                  {pgIdx === 0 ? "🎯 Rencana Awal" : `✏️ Penyesuaian #${pgIdx}`}
                                </span>
                                <span className="text-[10px] text-primary-400">•</span>
                                <span className="text-[10px] text-primary-500">
                                  {formatTime(planGroup.planTime)}
                                </span>
                                <span className="text-[10px] text-gray-400 ml-auto font-mono">
                                  {planGroup.planId.slice(-8)}
                                </span>
                              </div>
                              {/* Entries for this plan */}
                              <div className="divide-y divide-gray-50">
                                {planGroup.entries.map((entry) => (
                                  <HistoryFoodCard
                                    key={entry.id}
                                    entry={entry}
                                    onRate={handleRate}
                                    ratedMap={ratedMap}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
      </div>
    </div>
  );
}