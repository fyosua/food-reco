import { useEffect, useRef, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/auth";

export default function Layout() {
  const { isAuthenticated, user, isCheckingAuth, checkAuth, logout } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Show loading spinner while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

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

            {isAuthenticated && user ? (
              <div ref={profileRef} className="relative">
                {/* Profile button */}
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1.5 transition"
                >
                  <div className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs text-gray-600 max-w-[100px] truncate hidden sm:inline">
                    {user.email.split("@")[0]}
                  </span>
                  <svg
                    className={`w-3 h-3 text-gray-400 transition ${
                      profileOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown menu */}
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {user.email}
                      </p>
                      <p className="text-xs text-gray-400 capitalize">
                        {user.role}
                      </p>
                    </div>

                    <Link
                      to="/preferences"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                    >
                      <span>⚙️</span>
                      <span>Preferences</span>
                    </Link>

                    <Link
                      to="/history"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                    >
                      <span>📋</span>
                      <span>History</span>
                    </Link>

                    <Link
                      to="/change-password"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                    >
                      <span>🔒</span>
                      <span>Ubah Password</span>
                    </Link>

                    {user.role === "admin" && (
                      <Link
                        to="/admin"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-purple-700 hover:bg-purple-50 transition"
                      >
                        <span>🛠️</span>
                        <span>Admin Panel</span>
                      </Link>
                    )}

                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                      >
                        <span>🚪</span>
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
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