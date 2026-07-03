import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="plan" element={<PlanPage />} />
          <Route path="preferences" element={<PreferencesPage />} />
          <Route path="history" element={<HistoryPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-4xl font-bold text-primary-700 mb-4">
        Selamat Datang di FoodReco 🍽️
      </h1>
      <p className="text-lg text-gray-600 max-w-xl mb-8">
        Personalized daily meal plans tailored to your taste, budget, and health
        needs — from local Indonesian food, priced by your city.
      </p>
      <div className="flex gap-4">
        <a
          href="/register"
          className="bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 transition"
        >
          Get Started
        </a>
        <a
          href="/login"
          className="border border-primary-600 text-primary-600 px-6 py-3 rounded-lg font-medium hover:bg-primary-50 transition"
        >
          Log In
        </a>
      </div>
    </div>
  );
}

function LoginPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Login</h1><p className="text-gray-500 mt-2">Coming soon...</p></div>;
}

function RegisterPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Register</h1><p className="text-gray-500 mt-2">Coming soon...</p></div>;
}

function PlanPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Meal Plan</h1><p className="text-gray-500 mt-2">Coming soon...</p></div>;
}

function PreferencesPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Your Preferences</h1><p className="text-gray-500 mt-2">Coming soon...</p></div>;
}

function HistoryPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">Meal History</h1><p className="text-gray-500 mt-2">Coming soon...</p></div>;
}

export default App;