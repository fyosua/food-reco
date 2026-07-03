import { useState } from "react";
import type { MealResponse } from "../lib/api";
import MacroBadge from "./MacroBadge";
interface FoodCardProps {
  meal: MealResponse;
  onRate: (foodItemId: number, rating: number) => void;
}

export default function FoodCard({ meal, onRate }: FoodCardProps) {
  const [rated, setRated] = useState<number | null>(null);

  const handleRate = (rating: number) => {
    setRated(rating);
    const firstId = meal.dataset_item_ids[0];
    if (firstId !== undefined) {
      onRate(firstId as number, rating);
    }
  };

  const slotColors: Record<string, string> = {
    breakfast: "border-l-yellow-400",
    lunch: "border-l-orange-500",
    dinner: "border-l-purple-500",
    snack: "border-l-blue-400",
  };

  const slotLabels: Record<string, string> = {
    breakfast: "Sarapan",
    lunch: "Makan Siang",
    dinner: "Makan Malam",
    snack: "Camilan",
  };

  const slotIcons: Record<string, string> = {
    breakfast: "🌅",
    lunch: "☀️",
    dinner: "🌙",
    snack: "🍪",
  };

  const borderColor = slotColors[meal.slot] || "border-l-gray-400";

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-200 border-l-4 ${borderColor} overflow-hidden transition hover:shadow-md`}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-1">
          <div>
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
              {slotIcons[meal.slot]}{" "}
              {slotLabels[meal.slot] || meal.slot}
            </span>
            <h3 className="text-lg font-bold text-gray-800 mt-0.5">
              {meal.name}
            </h3>
            {meal.name_en && (
              <p className="text-sm text-gray-400">{meal.name_en}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-primary-700">
              Rp {meal.price_idr.toLocaleString("id-ID")}
            </div>
            <span className="text-xs text-gray-400 capitalize">
              {meal.prep_type === "buy_ready" ? "Beli Jadi" : "Masak Simple"}
            </span>
          </div>
        </div>

        {meal.description && (
          <p className="text-sm text-gray-600 mt-1">{meal.description}</p>
        )}
      </div>

      {/* Macro badges */}
      <div className="px-4 pb-2 flex flex-wrap gap-1.5">
        {meal.nutrition.calories != null && (
          <MacroBadge
            label="Kal"
            value={Math.round(meal.nutrition.calories)}
            unit=""
            color="orange"
          />
        )}
        {meal.nutrition.protein_g != null && (
          <MacroBadge
            label="Protein"
            value={meal.nutrition.protein_g}
            unit="g"
            color="green"
          />
        )}
        {meal.nutrition.carbs_g != null && (
          <MacroBadge
            label="Karbo"
            value={meal.nutrition.carbs_g}
            unit="g"
            color="blue"
          />
        )}
        {meal.nutrition.fat_g != null && (
          <MacroBadge
            label="Lemak"
            value={meal.nutrition.fat_g}
            unit="g"
            color="purple"
          />
        )}
        {meal.nutrition.fiber_g != null && (
          <MacroBadge
            label="Serat"
            value={meal.nutrition.fiber_g}
            unit="g"
            color="green"
          />
        )}
      </div>

      {/* Ingredients */}
      {meal.ingredients.length > 0 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-400">
            {meal.ingredients.join(", ")}
          </p>
        </div>
      )}

      {/* Rating */}
      <div className="px-4 pb-4 flex items-center gap-2">
        <span className="text-xs text-gray-400">Suka?</span>
        <button
          onClick={() => handleRate(1)}
          className={`px-3 py-1 rounded-full text-sm transition ${
            rated === 1
              ? "bg-green-100 text-green-700 border border-green-300"
              : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-green-50"
          }`}
        >
          👍
        </button>
        <button
          onClick={() => handleRate(-1)}
          className={`px-3 py-1 rounded-full text-sm transition ${
            rated === -1
              ? "bg-red-100 text-red-700 border border-red-300"
              : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-red-50"
          }`}
        >
          👎
        </button>
      </div>
    </div>
  );
}