import { create } from "zustand";
import type { Mechanic } from "@/types";

const SESSION_DURATION = 12 * 60 * 60 * 1000; // 12 hours
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

interface AuthStore {
  mechanic: Mechanic | null;
  token: string | null;
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
    const store = useAuthStore.getState();
    store.logout();
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
        mechanic: data.mechanic || null,
        token: data.token || null,
        sessionExpiresAt: data.sessionExpiresAt || null,
      };
    }
  } catch {
    // ignore
  }
  return { mechanic: null, token: null, sessionExpiresAt: null };
}

export const useAuthStore = create<AuthStore>((set, get) => {
  const restored = restoreAuth();
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
          mechanic: data.mechanic,
          token: data.token,
          sessionExpiresAt: Date.now() + SESSION_DURATION,
        };

        sessionStorage.setItem("arellan-auth", JSON.stringify(authData));
        set({ ...authData, isLoading: false });
        startInactivityTimer();
        return true;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "PIN inválido";
        set({ isLoading: false, error: message });
        return false;
      }
    },

    logout: () => {
      stopInactivityTimer();
      sessionStorage.removeItem("arellan-auth");
      set({ mechanic: null, token: null, sessionExpiresAt: null });
    },

    checkSession: () => {
      const { sessionExpiresAt } = get();
      if (!sessionExpiresAt) return false;
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
