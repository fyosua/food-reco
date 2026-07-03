import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { api, type HistoryEntry } from "../lib/api";

export default function HistoryPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    api
      .getHistory()
      .then(setHistory)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [isAuthenticated, navigate]);

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

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        📜 Riwayat Makan
      </h1>

      {isLoading && (
        <div className="text-center text-gray-400 py-12">Loading...</div>
      )}

      {!isLoading && history.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🍽️</div>
          <h2 className="text-lg font-bold text-gray-700 mb-2">
            Belum ada riwayat
          </h2>
          <p className="text-gray-400 text-sm">
            Rencana makan akan muncul di sini setelah kamu membuatnya.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {history.map((entry) => (
          <div
            key={entry.id}
            className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4"
          >
            <div className="text-2xl">
              {slotIcons[entry.slot] || "🍽️"}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-800 truncate">
                  {entry.food_name || `Food #${entry.food_item_id}`}
                </h3>
                {entry.food_category && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded capitalize">
                    {entry.food_category}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                <span>{slotLabels[entry.slot] || entry.slot}</span>
                {entry.calories && (
                  <>
                    <span>•</span>
                    <span>{Math.round(entry.calories)} kcal</span>
                  </>
                )}
                <span>•</span>
                <span>
                  {new Date(entry.served_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}