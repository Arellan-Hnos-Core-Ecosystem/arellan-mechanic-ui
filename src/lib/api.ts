import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1",
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

api.interceptors.request.use((config) => {
  const stored = sessionStorage.getItem("arellan-auth");
  if (stored) {
    try {
      const { accessToken } = JSON.parse(stored);
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
    } catch { /* ignore */ }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    if (response?.status === 401 && config && !config._retry) {
      config._retry = true;
      try {
        const stored = sessionStorage.getItem("arellan-auth");
        if (!stored) throw new Error("No session");

        const { refreshToken } = JSON.parse(stored);
        if (!refreshToken) throw new Error("No refresh token");

        if (!isRefreshing) {
          isRefreshing = true;
          const { data } = await axios.post(
            `${import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1"}/auth/refresh`,
            { refreshToken },
          );
          isRefreshing = false;

          const prev = JSON.parse(sessionStorage.getItem("arellan-auth") || "{}");
          prev.accessToken = data.accessToken;
          if (data.refreshToken) prev.refreshToken = data.refreshToken;
          sessionStorage.setItem("arellan-auth", JSON.stringify(prev));

          onTokenRefreshed(data.accessToken);
        }

        return new Promise((resolve) => {
          subscribeTokenRefresh((token: string) => {
            config.headers.Authorization = `Bearer ${token}`;
            resolve(api(config));
          });
        });
      } catch {
        isRefreshing = false;
        refreshSubscribers = [];
        sessionStorage.removeItem("arellan-auth");
        if (window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
