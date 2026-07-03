import { create } from "zustand";
import { api, type UserProfile } from "../lib/api";

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isCheckingAuth: boolean; // true while initial auth check runs
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  isCheckingAuth: true, // starts true until checkAuth completes
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.login(email, password);
      // Fetch user profile after login
      const user = await api.me();
      set({ user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Login failed";
      set({ error: message, isLoading: false });
      return false;
    }
  },

  register: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.register(email, password);
      // Auto-login after register
      return await api.login(email, password).then(async () => {
        const user = await api.me();
        set({ user, isAuthenticated: true, isLoading: false });
        return true;
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Registration failed";
      set({ error: message, isLoading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      const user = await api.me();
      set({ user, isAuthenticated: true, isCheckingAuth: false });
    } catch {
      set({ user: null, isAuthenticated: false, isCheckingAuth: false });
    }
  },

  clearError: () => set({ error: null }),
}));