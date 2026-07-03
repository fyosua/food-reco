import { useEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/auth";

export default function Layout() {
  const { isAuthenticated, user, checkAuth, logout } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
        <nav className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-primary-700">
            🍽️ FoodReco
          </Link>

          <div className="flex items-center gap-4 text-sm">
            <Link
              to="/plan"
              className="text-gray-600 hover:text-primary-600 transition"
            >
              Plan
            </Link>
            <Link
              to="/history"
              className="text-gray-600 hover:text-primary-600 transition"
            >
              History
            </Link>
            <Link
              to="/preferences"
              className="text-gray-600 hover:text-primary-600 transition"
            >
              Preferences
            </Link>

            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 hidden sm:inline">
                  {user.email}
                </span>
                <button
                  onClick={logout}
                  className="text-gray-500 hover:text-red-600 transition text-xs"
                >
                  Logout
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-primary-600 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-primary-700 transition text-xs"
              >
                Login
              </Link>
            )}
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        FoodReco — Gratis &amp; Terbuka untuk Semua
      </footer>
    </div>
  );
}