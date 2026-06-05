import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Spinner,
  OrderStatusBadge,
  Skeleton,
  EmptyState,
  StatusIndicator,
} from "@arellan-hnos-core-ecosystem/ui";
import { useAuthStore } from "@/stores/auth";
import { useOfflineStore } from "@/stores/offline";
import { useMyOrders } from "@/hooks/use-orders";
import type { Order } from "@/types";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { mechanic, logout, resetInactivityTimer } = useAuthStore();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const queueSize = useOfflineStore((s) => s.queue.length);
  const { data: rawOrders, isLoading, error } = useMyOrders();
  const orders: Order[] = Array.isArray(rawOrders) ? rawOrders : [];

  const handleActivity = useCallback(() => resetInactivityTimer(), [resetInactivityTimer]);

  useEffect(() => {
    document.addEventListener("touchstart", handleActivity, { passive: true });
    document.addEventListener("click", handleActivity);
    return () => {
      document.removeEventListener("touchstart", handleActivity);
      document.removeEventListener("click", handleActivity);
    };
  }, [handleActivity]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Container className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#1B3A6B] text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Arellan Taller</h1>
            <p className="text-sm opacity-80">
              {mechanic?.name} ({mechanic?.role === "MECHANIC" ? "Mecánico" : "Aprendiz"})
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusIndicator
              status={isOnline ? "active" : "offline"}
              label={isOnline ? "En línea" : "Sin conexión"}
            />
            {queueSize > 0 && (
              <Badge variant="warning">{queueSize} pend.</Badge>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white hover:bg-white/10">
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate("/vehicle-intake")}
            className="h-16 text-base font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm transition-colors flex items-center justify-center"
          >
            + Ingreso de Vehiculo
          </button>
          <button
            type="button"
            onClick={() => navigate("/parts-request")}
            className="h-16 text-base font-semibold rounded-lg bg-slate-700 text-white hover:bg-slate-800 active:bg-slate-900 shadow-sm transition-colors flex items-center justify-center"
          >
            Solicitar Repuestos
          </button>
        </div>

        {/* Orders Section */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Mis Órdenes de Trabajo
          </h2>

          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <Skeleton key={n} className="h-28 w-full rounded-lg" />
              ))}
            </div>
          )}

          {error && !isLoading && (
            <Card>
              <CardContent className="text-center py-8 text-red-500">
                Error al cargar órdenes. Verifique su conexión.
              </CardContent>
            </Card>
          )}

          {!isLoading && orders && orders.length === 0 && (
            <EmptyState
              title="Sin órdenes asignadas"
              description="No tiene órdenes de trabajo pendientes. Solicite nuevas asignaciones al supervisor."
            />
          )}

          {!isLoading &&
            orders &&
            orders.map((order: Order) => (
              <Card
                key={order.id}
                className="mb-3 cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-lg text-gray-900">
                      [{order.vehiclePlate}] {order.vehicleBrand} {order.vehicleModel}
                    </p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2">
                    {order.description}
                  </p>
                  <div className="flex items-center gap-2 mt-3 text-xs text-gray-400">
                    <span>OT #{order.id?.slice(0, 8)}</span>
                    {(order.partsUsed?.length ?? 0) > 0 && (
                      <span>· {order.partsUsed?.length ?? 0} repuestos</span>
                    )}
                    {(order.photos?.length ?? 0) > 0 && (
                      <span>· {order.photos?.length ?? 0} fotos</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
        </section>

        {!isOnline && (
          <div className="fixed bottom-4 left-4 right-4">
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-3 flex items-center gap-2">
                <StatusIndicator status="offline" label="Sin conexion" />
                <p className="text-sm text-amber-800">
                  Modo sin conexión. Los cambios se sincronizarán al reconectar.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </Container>
  );
}
