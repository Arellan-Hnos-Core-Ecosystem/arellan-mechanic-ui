import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Arellan Taller - Mecánicos",
        short_name: "Arellan Taller",
        description: "Tablet PWA para mecánicos del taller Arellan Hnos",
        theme_color: "#1B3A6B",
        background_color: "#1B3A6B",
        display: "standalone",
        orientation: "portrait",
        start_url: "/login",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /\/login(\?.*)?$/,
            handler: "CacheFirst",
            options: {
              cacheName: "page-login",
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: /\/dashboard(\?.*)?$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "page-dashboard",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: /\/orders(\?.*)?$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "page-orders",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: /\/vehicle-intake(\?.*)?$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "page-intake",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: /\/parts-request(\?.*)?$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "page-parts",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: /\/api\/.*/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: /\.(?:js|css)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    // El paquete ui (file:-linkeado) trae su propio node_modules con react:
    // dedupe fuerza una unica copia de react en el bundle (evita "Invalid hook call")
    dedupe: ["react", "react-dom"],
  },
  server: {
    port: 3003,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
