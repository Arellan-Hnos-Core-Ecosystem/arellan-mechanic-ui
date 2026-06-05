import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";
import { initSyncService } from "@/offline/sync";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import MechanicProgressPage from "@/pages/MechanicProgressPage";
import VehicleIntakePage from "@/pages/VehicleIntakePage";
import PartsRequestPage from "@/pages/PartsRequestPage";
import PhotoUploadPage from "@/pages/PhotoUploadPage";
import CheckInPage from "@/pages/CheckInPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const checkSession = useAuthStore((s) => s.checkSession);
  if (!checkSession()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const resetInactivityTimer = useAuthStore((s) => s.resetInactivityTimer);

  useEffect(() => {
    initSyncService();
    const handler = () => resetInactivityTimer();
    document.addEventListener("pointerdown", handler, { passive: true });
    document.addEventListener("keydown", handler, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", handler);
      document.removeEventListener("keydown", handler);
    };
  }, [resetInactivityTimer]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/:id"
        element={
          <ProtectedRoute>
            <OrderDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/vehicle-intake"
        element={
          <ProtectedRoute>
            <VehicleIntakePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parts-request"
        element={
          <ProtectedRoute>
            <PartsRequestPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/photo-upload"
        element={
          <ProtectedRoute>
            <PhotoUploadPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/:id/progress"
        element={
          <ProtectedRoute>
            <MechanicProgressPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/check-in"
        element={
          <ProtectedRoute>
            <CheckInPage />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
