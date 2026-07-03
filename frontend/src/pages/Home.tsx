import { Link } from "react-router-dom";
import { useAuthStore } from "../store/auth";

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="text-6xl mb-6">🍽️</div>
      <h1 className="text-4xl font-bold text-primary-700 mb-4">
        Selamat Datang di FoodReco
      </h1>
      <p className="text-lg text-gray-600 max-w-xl mb-8">
        Rencana makan harian yang dipersonalisasi sesuai selera, budget, dan
        kebutuhan kesehatanmu — dari makanan lokal Indonesia, dengan harga
        sesuai kota kamu.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mb-10">
        {[
          { icon: "🎯", title: "Preferences First", desc: "Rekomendasi berdasarkan selera, bukan hanya kesehatan" },
          { icon: "🏙️", title: "Local Pricing", desc: "Harga disesuaikan dengan kota dan provinsi kamu" },
          { icon: "🔄", title: "Never Boring", desc: "Variasi menu setiap hari, tidak pernah bosan" },
        ].map((feature) => (
          <div
            key={feature.title}
            className="bg-white border border-gray-200 rounded-xl p-5 text-center"
          >
            <div className="text-3xl mb-2">{feature.icon}</div>
            <h3 className="font-semibold text-gray-800 mb-1">{feature.title}</h3>
            <p className="text-xs text-gray-500">{feature.desc}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        {isAuthenticated ? (
          <Link
            to="/plan"
            className="bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition"
          >
            🎯 Buat Rencana Makan
          </Link>
        ) : (
          <>
            <Link
              to="/register"
              className="bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="border border-primary-600 text-primary-600 px-6 py-3 rounded-lg font-medium hover:bg-primary-50 transition"
            >
              Log In
            </Link>
          </>
        )}
      </div>
    </div>
  );
}