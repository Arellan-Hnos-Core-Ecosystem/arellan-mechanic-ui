import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api/v1",
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

let isRedirecting = false;

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
  (error) => {
    if (error.response?.status === 401) {
      if (!isRedirecting && window.location.pathname !== "/login") {
        isRedirecting = true;
        sessionStorage.removeItem("arellan-auth");
        window.location.replace("/login");
      }
    }
    return Promise.reject(error);
  }
);

export default api;
