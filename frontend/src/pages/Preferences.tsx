import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { api, type UserPrefs, type City } from "../lib/api";
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
  { id: "none", label: "No specific condition", sex: null },
  { id: "pregnant", label: "Pregnancy", sex: "female" },
  { id: "diabetes", label: "Diabetes", sex: null },
  { id: "hypertension", label: "Hypertension", sex: null },
  { id: "heart_disease", label: "Heart Disease", sex: null },
  { id: "kidney_disease", label: "Kidney Disease", sex: null },
  { id: "weight_loss", label: "Weight Loss", sex: null },
  { id: "lactose_intolerant", label: "Lactose Intolerant", sex: null },
  { id: "vegan", label: "Vegan", sex: null },
  { id: "vegetarian", label: "Vegetarian", sex: null },
  { id: "ulcer", label: "Stomach Ulcer / GERD", sex: null },
  { id: "gout", label: "Gout / High Uric Acid", sex: null },
  { id: "anemia", label: "Anemia", sex: null },
];

const PROTEINS = ["chicken", "beef", "fish", "egg", "tofu", "tempeh", "shrimp", "lamb"];

const CONDITION_LABELS: Record<string, string> = {
  pregnant: "Pregnancy", diabetes: "Diabetes", hypertension: "Hypertension",
  heart_disease: "Heart Disease", kidney_disease: "Kidney Disease",
  weight_loss: "Weight Loss", lactose_intolerant: "Lactose Intolerant",
  vegan: "Vegan", vegetarian: "Vegetarian", ulcer: "Stomach Ulcer / GERD",
  gout: "Gout / High Uric Acid", anemia: "Anemia",
};

type OnboardingStep = "welcome" | "allergies" | "dislikes" | "likes" | "cuisines" | "spice" | "prep" | "condition" | "city" | "done" | "summary";

export default function PreferencesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [savedPrefs, setSavedPrefs] = useState<UserPrefs | null>(null);
  const [savedCity, setSavedCity] = useState<City | null>(null);
  const [loading, setLoading] = useState(true);

  // Wizard state
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [likes, setLikes] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [spiceLevel, setSpiceLevel] = useState(3);
  const [prepLean, setPrepLean] = useState("balanced");
  const [condition, setCondition] = useState<string[]>(["none"]);
  const [sex, setSex] = useState("male");
  const [city, setCity] = useState<City | null>(null);
  const [dailyBudget, setDailyBudget] = useState(50000);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Load existing preferences on mount
  useEffect(() => {
    async function loadPrefs() {
      try {
        const [prefsRes, cityRes] = await Promise.all([
          api.getPreferences().catch(() => null),
          api.searchCities("", 1000).catch(() => [] as City[]),
        ]);
        if (prefsRes && prefsRes.default_conditions && prefsRes.default_conditions.length > 0) {
          setSavedPrefs(prefsRes);
          setAllergies(prefsRes.exclusions_json ? JSON.parse(prefsRes.exclusions_json) : []);
          setCondition(prefsRes.default_conditions.length > 0 ? prefsRes.default_conditions : ["none"]);
          setSex(prefsRes.default_sex || "male");
          setDailyBudget(prefsRes.daily_budget_idr || 50000);
          setPrepLean(prefsRes.prep_lean || "balanced");
          if (prefsRes.default_city_id) {
            const found = cityRes.find((c: City) => c.id === prefsRes.default_city_id);
            if (found) {
              setSavedCity(found);
              setCity(found);
            }
          }
          setStep("summary");
        } else {
          setStep(user ? "allergies" : "welcome");
        }
      } catch {
        setStep(user ? "allergies" : "welcome");
      } finally {
        setLoading(false);
      }
    }
    loadPrefs();
  }, [user]);

  const handleSave = async () => {
    if (!city) {
      setError("Pilih kota terlebih dahulu");
      return;
    }
    setIsSaving(true);
    setError("");

    try {
      await api.updatePreferences({
        default_conditions: condition.includes("none") ? [] : condition,
        default_sex: sex,
        default_city_id: city.id,
        daily_budget_idr: dailyBudget,
        per_meal_budget_idr: Math.round(dailyBudget / 3),
        variety_appetite: 0.7,
        prep_lean: prepLean,
        exclusions_json: JSON.stringify(allergies),
      });

      const prefsRes = await api.getPreferences();
      setSavedPrefs(prefsRes);
      if (city) setSavedCity(city);
      setStep("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan preferensi";
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = () => {
    setStep("allergies");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <p className="text-gray-400">Memuat...</p>
      </div>
    );
  }

  // ── SUMMARY VIEW (existing preferences) ──
  if (step === "summary" && savedPrefs) {
    const exclusions = savedPrefs.exclusions_json ? JSON.parse(savedPrefs.exclusions_json) : [];
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Preferensi Saya</h1>
          <button
            onClick={startEdit}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition"
          >
            Edit Preferensi
          </button>
        </div>

        <div className="space-y-4">
          {/* Kondisi Kesehatan */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-700 mb-2">Kondisi Kesehatan</h3>
            <div className="flex flex-wrap gap-1.5">
              {savedPrefs.default_conditions && savedPrefs.default_conditions.length > 0
                ? savedPrefs.default_conditions.map((c: string) => (
                    <span key={c} className="px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">
                      {CONDITION_LABELS[c] || c}
                    </span>
                  ))
                : <span className="text-gray-400 text-sm">Tidak ada kondisi khusus</span>}
            </div>
          </div>

          {/* Jenis Kelamin */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-700 mb-1">Jenis Kelamin</h3>
            <p className="text-gray-600 text-sm capitalize">{savedPrefs.default_sex === "male" ? "Laki-laki" : "Perempuan"}</p>
          </div>

          {/* Kota */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-700 mb-1">Kota</h3>
            <p className="text-gray-600 text-sm">
              {savedCity ? `${savedCity.name}${savedCity.province_name ? `, ${savedCity.province_name}` : ""}` : `ID kota: ${savedPrefs.default_city_id}`}
            </p>
          </div>

          {/* Budget */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-700 mb-1">Budget Harian</h3>
            <p className="text-gray-600 text-sm">Rp {savedPrefs.daily_budget_idr?.toLocaleString("id-ID")} / hari</p>
          </div>

          {/* Alergi */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-700 mb-2">Alergi</h3>
            {exclusions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {exclusions.map((a: string) => (
                  <span key={a} className="px-2.5 py-1 bg-red-50 text-red-600 rounded-full text-xs font-medium">{a}</span>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Tidak ada alergi</p>
            )}
          </div>

          {/* Persiapan */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold text-gray-700 mb-1">Persiapan Makanan</h3>
            <p className="text-gray-600 text-sm capitalize">
              {savedPrefs.prep_lean === "buy_ready" ? "Beli Jadi" : savedPrefs.prep_lean === "simple_cook" ? "Masak Simple" : "Seimbang"}
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => navigate("/plan")}
            className="flex-1 bg-primary-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-primary-700 transition"
          >
            Buat Rencana Makan
          </button>
          <button
            onClick={() => navigate("/")}
            className="flex-1 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition"
          >
            Beranda
          </button>
        </div>
      </div>
    );
  }

  // ── WIZARD STEPS ──

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
                onClick={() => {
                  setAllergies((prev) =>
                    prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
                  );
                }}
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
                onClick={() => {
                  setDislikes((prev) =>
                    prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                  );
                }}
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
                onClick={() => {
                  setLikes((prev) =>
                    prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                  );
                }}
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
                onClick={() => {
                  setCuisines((prev) =>
                    prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                  );
                }}
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
          <p className="text-gray-500 text-sm mb-2">
            Pilih kondisi yang relevan (bisa lebih dari satu)
          </p>
          <p className="text-gray-400 text-xs mb-6">
            Aturan kesehatan akan digabungkan secara otomatis
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {CONDITIONS.filter(c => c.id !== "none" && (!c.sex || c.sex === sex)).map((c) => {
              const isSelected = condition.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setCondition((prev) =>
                      isSelected
                        ? prev.filter((x) => x !== c.id)
                        : [...prev.filter((x) => x !== "none"), c.id]
                    );
                  }}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition ${
                    isSelected
                      ? "bg-primary-100 border-primary-300 text-primary-700"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {c.label}
                  {isSelected && <span className="ml-1.5 text-primary-400">✓</span>}
                </button>
              );
            })}
          </div>
          {condition.length === 0 || condition.includes("none") ? (
            <p className="text-xs text-gray-400 mb-4 italic">Tidak ada kondisi khusus</p>
          ) : (
            <p className="text-xs text-primary-600 mb-4">
              {condition.length} kondisi terpilih
            </p>
          )}

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
                  onClick={() => {
                      setSex(opt.id);
                      // Auto-deselect female-only conditions if switching to male
                      if (opt.id === "male") {
                        setCondition((prev) => prev.filter((cId) => {
                          const cond = CONDITIONS.find((c) => c.id === cId);
                          return !cond || !cond.sex || cond.sex !== "female";
                        }));
                      }
                    }}
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