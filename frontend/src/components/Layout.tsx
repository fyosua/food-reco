import { Link, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <nav className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-primary-700">
            FoodReco
          </Link>
          <div className="flex gap-4 text-sm">
            <Link to="/plan" className="text-gray-600 hover:text-primary-600">
              Plan
            </Link>
            <Link to="/history" className="text-gray-600 hover:text-primary-600">
              History
            </Link>
            <Link to="/login" className="text-gray-600 hover:text-primary-600">
              Login
            </Link>
          </div>
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-gray-200 py-4 text-center text-xs text-gray-400">
        FoodReco — Free &amp; Open
      </footer>
    </div>
  );
}