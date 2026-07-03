import { Link } from "react-router-dom";

export default function RegisterPage() {
  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-md text-center">
        {/* Lock icon */}
        <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-3">
          Pendaftaran Ditutup
        </h1>

        <p className="text-gray-600 mb-2 leading-relaxed">
          FoodReco saat ini dalam tahap pengembangan tertutup.
          Pendaftaran akun baru hanya tersedia melalui pemilik aplikasi.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 my-6 text-left">
          <p className="text-sm text-blue-800 font-medium mb-2">
            Ingin mencoba FoodReco?
          </p>
          <p className="text-sm text-blue-700">
            Silakan hubungi pemilik aplikasi secara langsung untuk meminta akun.
          </p>
        </div>

        <p className="text-sm text-gray-500">
          Sudah punya akun?{" "}
          <Link to="/login" className="text-primary-600 hover:underline font-medium">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}