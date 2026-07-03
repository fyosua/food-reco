import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { api } from "../lib/api";
import CitySearch from "../components/CitySearch";

const ALLERGENS = [
  "peanut", "shellfish", "dairy", "egg", "gluten", "soy", "fish", "sesame",
];

const CUISINES = [
  { id: "jawa", label: "Jawa" },
  { id: "padang", label: "Padang" },
  { id: "sunda", label: "Sunda" },
  { id: "bali", label: "Bali" },
  { id: "manado", label: "Manado" },
  { id: "batak", label: "Batak" },
  { id: "palembang", label: "Palembang" },
  { id: "lombok", label: "Lombok/Sasak" },
  { id: "chinese_indonesian", label: "Chinese Indonesian" },
  { id: "japanese", label: "Japanese" },
  { id: "western", label: "Western" },
];

const CONDITIONS = [
  { id: "none", label: "No specific condition" },
  { id: "pregnant", label: "Pregnancy" },
  { id: "diabetes", label: "Diabetes" },
  { id: "hypertension", label: "Hypertension" },
  { id: "heart_disease", label: "Heart Disease" },
  { id: "kidney_disease", label: "Kidney Disease" },
  { id: "weight_loss", label: "Weight Loss" },
  { id: "lactose_intolerant", label: "Lactose Intolerant" },
  { id: "vegan", label: "Vegan" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "ulcer", label: "Stomach Ulcer / GERD" },
  { id: "gout", label: "Gout / High Uric Acid" },
  { id: "anemia", label: "Anemia" },
];

const PROTEINS = ["chicken", "beef", "fish", "egg", "tofu", "tempeh", "shrimp", "lamb"];

type OnboardingStep = "welcome" | "allergies" | "dislikes" | "likes" | "cuisines" | "spice" | "prep" | "condition" | "city" | "budget" | "done";

export default function PreferencesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [step, setStep] = useState<OnboardingStep>(user ? "allergies" : "welcome");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [likes, setLikes] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [spiceLevel, setSpiceLevel] = useState(3);
  const [prepLean, setPrepLean] = useState("balanced");
  const [condition, setCondition] = useState("none");
  const [sex, setSex] = useState("male");
  const [city, setCity] = useState<{ id: number; name: string } | null>(null);
  const [dailyBudget, setDailyBudget] = useState(50000);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleAllergen = (a: string) => {
    setAllergies((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
    );
  };

  const toggleDislike = (d: string) => {
    setDislikes((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  const toggleLike = (l: string) => {
    setLikes((prev) =>
      prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]
    );
  };

  const toggleCuisine = (c: string) => {
    setCuisines((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const handleSave = async () => {
    if (!city) {
      setError("Pilih kota terlebih dahulu");
      return;
    }
    setIsSaving(true);
    setError("");

    try {
      // Build taste entries (used implicitly via API)
      await api.updatePreferences({
        default_condition: condition === "none" ? undefined : condition,
        default_sex: sex,
        default_city_id: city.id,
        daily_budget_idr: dailyBudget,
        per_meal_budget_idr: Math.round(dailyBudget / 3),
        variety_appetite: 0.7,
        prep_lean: prepLean,
        exclusions_json: JSON.stringify(allergies),
      });

      setStep("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan preferensi";
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex justify-center gap-1 mb-8">
      {["allergies", "dislikes", "likes", "cuisines", "spice", "prep", "condition", "city"].map(
        (s) => (
          <div
            key={s}
            className={`w-3 h-3 rounded-full transition ${
              step === s
                ? "bg-primary-500 scale-125"
                : ["allergies", "dislikes", "likes", "cuisines", "spice", "prep", "condition", "city"].indexOf(s) <
                  ["allergies", "dislikes", "likes", "cuisines", "spice", "prep", "condition", "city"].indexOf(
                    step as string
                  )
                ? "bg-primary-300"
                : "bg-gray-200"
            }`}
          />
        )
      )}
    </div>
  );

  const CtaButton = ({
    onClick,
    label,
    disabled,
  }: {
    onClick: () => void;
    label: string;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50"
    >
      {label}
    </button>
  );

  if (step === "welcome") {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="text-center max-w-lg">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            Selamat datang! 🎉
          </h1>
          <p className="text-gray-600 mb-2">
            Mari kita atur preferensi makananmu agar FoodReco bisa memberikan
            rekomendasi yang tepat.
          </p>
          <p className="text-gray-500 text-sm mb-8">
            Proses ini hanya perlu beberapa menit.
          </p>
          <CtaButton
            onClick={() => setStep("allergies")}
            label="Mulai →"
          />
        </div>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="text-center max-w-lg">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Preferensi tersimpan!
          </h1>
          <p className="text-gray-600 mb-8">
            Sekarang kamu bisa langsung mendapatkan rekomendasi menu harian.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate("/plan")}
              className="bg-primary-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition"
            >
              Buat Rencana Makan
            </button>
            <button
              onClick={() => navigate("/")}
              className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition"
            >
              Ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <StepIndicator />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Allergies */}
      {step === "allergies" && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Alergi Makanan
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            Pilih makanan yang kamu alergi (akan dikecualikan sepenuhnya)
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {ALLERGENS.map((a) => (
              <button
                key={a}
                onClick={() => toggleAllergen(a)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                  allergies.includes(a)
                    ? "bg-red-100 border-red-300 text-red-700"
                    : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <CtaButton onClick={() => setStep("dislikes")} label="Lanjut →" />
        </div>
      )}

      {/* Dislikes */}
      {step === "dislikes" && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Makanan yang Tidak Disukai
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            Bahan makanan yang kamu tidak suka
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {PROTEINS.map((p) => (
              <button
                key={p}
                onClick={() => toggleDislike(p)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                  dislikes.includes(p)
                    ? "bg-orange-100 border-orange-300 text-orange-700"
                    : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep("allergies")} className="text-gray-500 hover:text-gray-700">
              ← Kembali
            </button>
            <CtaButton onClick={() => setStep("likes")} label="Lanjut →" />
          </div>
        </div>
      )}

      {/* Likes */}
      {step === "likes" && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Makanan Favorit
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            Bahan makanan yang paling kamu suka
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {PROTEINS.map((p) => (
              <button
                key={p}
                onClick={() => toggleLike(p)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                  likes.includes(p)
                    ? "bg-green-100 border-green-300 text-green-700"
                    : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep("dislikes")} className="text-gray-500 hover:text-gray-700">
              ← Kembali
            </button>
            <CtaButton onClick={() => setStep("cuisines")} label="Lanjut →" />
          </div>
        </div>
      )}

      {/* Cuisines */}
      {step === "cuisines" && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Masakan Favorit
          </h2>
          <p className="text-gray-500 text-sm mb-4">
            Jenis masakan yang paling kamu suka
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {CUISINES.map((c) => (
              <button
                key={c.id}
                onClick={() => toggleCuisine(c.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                  cuisines.includes(c.id)
                    ? "bg-primary-100 border-primary-300 text-primary-700"
                    : "bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep("likes")} className="text-gray-500 hover:text-gray-700">
              ← Kembali
            </button>
            <CtaButton onClick={() => setStep("spice")} label="Lanjut →" />
          </div>
        </div>
      )}

      {/* Spice tolerance */}
      {step === "spice" && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Tingkat Kepedasan
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Seberapa pedas makanan yang kamu suka?
          </p>
          <div className="flex gap-2 mb-6">
            {[0, 1, 2, 3, 4, 5].map((level) => (
              <button
                key={level}
                onClick={() => setSpiceLevel(level)}
                className={`flex-1 py-3 rounded-lg text-center font-medium transition ${
                  spiceLevel === level
                    ? "bg-red-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {level === 0 ? "❌" : "🌶️".repeat(level)}
                <div className="text-xs mt-1">
                  {level === 0
                    ? "Tidak pedas"
                    : level === 5
                    ? "Ekstra pedas"
                    : ""}
                </div>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep("cuisines")} className="text-gray-500 hover:text-gray-700">
              ← Kembali
            </button>
            <CtaButton onClick={() => setStep("prep")} label="Lanjut →" />
          </div>
        </div>
      )}

      {/* Prep preference */}
      {step === "prep" && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Persiapan Makanan
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Bagaimana preferensi persiapan makananmu?
          </p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { id: "buy_ready", label: "Beli Jadi", desc: "Makanan siap santap" },
              { id: "simple_cook", label: "Masak Simple", desc: "Memasak ringan" },
              { id: "balanced", label: "Seimbang", desc: "Campuran" },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setPrepLean(opt.id)}
                className={`p-4 rounded-lg border text-center transition ${
                  prepLean === opt.id
                    ? "bg-primary-50 border-primary-300 text-primary-700"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs mt-1">{opt.desc}</div>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep("spice")} className="text-gray-500 hover:text-gray-700">
              ← Kembali
            </button>
            <CtaButton onClick={() => setStep("condition")} label="Lanjut →" />
          </div>
        </div>
      )}

      {/* Condition */}
      {step === "condition" && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Kondisi Kesehatan
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Pilih kondisi yang relevan untuk rekomendasi yang lebih tepat
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
            {CONDITIONS.map((c) => (
              <button
                key={c.id}
                onClick={() => setCondition(c.id)}
                className={`text-left px-3 py-2.5 rounded-lg border text-sm transition ${
                  condition === c.id
                    ? "bg-primary-50 border-primary-300 text-primary-700"
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jenis Kelamin
            </label>
            <div className="flex gap-3">
              {[
                { id: "male", label: "Laki-laki" },
                { id: "female", label: "Perempuan" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSex(opt.id)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
                    sex === opt.id
                      ? "bg-primary-50 border-primary-300 text-primary-700"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep("prep")} className="text-gray-500 hover:text-gray-700">
              ← Kembali
            </button>
            <CtaButton onClick={() => setStep("city")} label="Lanjut →" />
          </div>
        </div>
      )}

      {/* City + Budget */}
      {step === "city" && (
        <div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            Lokasi & Budget
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            Kota tempat tinggalmu dan budget harian untuk makan
          </p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kota
            </label>
            <CitySearch
              value={city?.id ?? null}
              onChange={(c) => setCity(c)}
              placeholder="Cari kota di Indonesia..."
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Budget Harian (IDR)
            </label>
            <input
              type="number"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(Number(e.target.value))}
              min={10000}
              max={500000}
              step={5000}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">
              Rp {(dailyBudget / 3).toLocaleString("id-ID")} per porsi (estimasi)
            </p>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep("condition")} className="text-gray-500 hover:text-gray-700">
              ← Kembali
            </button>
            <CtaButton
              onClick={handleSave}
              label={isSaving ? "Menyimpan..." : "Simpan Preferensi"}
              disabled={isSaving || !city}
            />
          </div>
        </div>
      )}
    </div>
  );
}