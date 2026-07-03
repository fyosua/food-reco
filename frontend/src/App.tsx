import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/Home";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import PlanPage from "./pages/Plan";
import PreferencesPage from "./pages/Preferences";
import HistoryPage from "./pages/History";
import ChangePasswordPage from "./pages/ChangePassword";
import AdminPage from "./pages/Admin";

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
          <Route path="change-password" element={<ChangePasswordPage />} />
          <Route path="admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;