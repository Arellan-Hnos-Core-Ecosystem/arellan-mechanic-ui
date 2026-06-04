import { create } from "zustand";
import type { Mechanic } from "@/types";

const SESSION_DURATION = 12 * 60 * 60 * 1000;
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

interface AuthStore {
  mechanic: Mechanic | null;
  accessToken: string | null;
  refreshToken: string | null;
  sessionExpiresAt: number | null;
  isLoading: boolean;
  error: string | null;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  checkSession: () => boolean;
  resetInactivityTimer: () => void;
}

let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

function startInactivityTimer() {
  stopInactivityTimer();
  inactivityTimer = setTimeout(() => {
    useAuthStore.getState().logout();
    window.location.href = "/login";
  }, INACTIVITY_TIMEOUT);
}

function stopInactivityTimer() {
  if (inactivityTimer) {
    clearTimeout(inactivityTimer);
    inactivityTimer = null;
  }
}

function restoreAuth() {
  try {
    const stored = sessionStorage.getItem("arellan-auth");
    if (stored) {
      const data = JSON.parse(stored);
      return {
        mechanic: data.mechanic ?? null,
        accessToken: data.accessToken ?? null,
        refreshToken: data.refreshToken ?? null,
        sessionExpiresAt: data.sessionExpiresAt ?? null,
      };
    }
  } catch { /* ignore */ }
  return { mechanic: null, accessToken: null, refreshToken: null, sessionExpiresAt: null };
}

let isLoggingOut = false;

export const useAuthStore = create<AuthStore>((set, get) => {
  const restored = restoreAuth();

  if (restored.sessionExpiresAt && Date.now() > restored.sessionExpiresAt) {
    sessionStorage.removeItem("arellan-auth");
    restored.mechanic = null;
    restored.accessToken = null;
    restored.refreshToken = null;
    restored.sessionExpiresAt = null;
  }

  return {
    ...restored,
    isLoading: false,
    error: null,

    login: async (pin: string): Promise<boolean> => {
      set({ isLoading: true, error: null });
      try {
        const { default: api } = await import("@/lib/api");
        const { data } = await api.post("/auth/mechanic/login", { pin });

        const authData = {
          mechanic: data.user ?? { id: data.user?.id, name: data.user?.name, role: data.user?.role },
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          sessionExpiresAt: Date.now() + SESSION_DURATION,
        };

        sessionStorage.setItem("arellan-auth", JSON.stringify(authData));
        set({ ...authData, isLoading: false });
        startInactivityTimer();
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "PIN invalido";
        set({ isLoading: false, error: message });
        return false;
      }
    },

    logout: () => {
      if (isLoggingOut) return;
      isLoggingOut = true;
      stopInactivityTimer();
      sessionStorage.removeItem("arellan-auth");
      set({ mechanic: null, accessToken: null, refreshToken: null, sessionExpiresAt: null });
    },

    checkSession: () => {
      const { sessionExpiresAt, accessToken } = get();
      if (!sessionExpiresAt || !accessToken) return false;
      if (Date.now() > sessionExpiresAt) {
        get().logout();
        return false;
      }
      startInactivityTimer();
      return true;
    },

    resetInactivityTimer: () => {
      startInactivityTimer();
    },
  };
});
