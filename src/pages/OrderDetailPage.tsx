import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  Toast,
  ConfirmDialog,
  StatusIndicator,
} from "@arellan-hnos-core-ecosystem/ui";
import { useOrder, useUpdateStatus } from "@/hooks/use-orders";
import type { Order, OrderStatus } from "@/types";

const STATUS_ACTIONS: { next: OrderStatus; label: string; color: string }[] = [
  { next: "IN_DIAGNOSIS", label: "Iniciar Diagnostico", color: "bg-blue-500" },
  { next: "BUDGETED", label: "Presupuestar", color: "bg-yellow-500" },
  { next: "IN_PROGRESS", label: "Iniciar Trabajo", color: "bg-orange-500" },
  { next: "IN_REVIEW", label: "Enviar a Revision", color: "bg-purple-500" },
  { next: "READY", label: "Marcar como Listo", color: "bg-green-500" },
  { next: "DELIVERED", label: "Entregar Vehiculo", color: "bg-green-600" },
];

function getAvailableActions(currentStatus: OrderStatus) {
  const flow: Record<OrderStatus, number> = {
    RECEIVED: 0,
    IN_DIAGNOSIS: 1,
    BUDGETED: 2,
    IN_PROGRESS: 3,
    IN_REVIEW: 4,
    READY: 5,
    DELIVERED: -1,
    CANCELLED: -1,
  };

  const current = flow[currentStatus];
  if (current < 0) return [];
  return STATUS_ACTIONS.filter((_, idx) => idx >= current);
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading, error } = useOrder(id);
  const updateStatus = useUpdateStatus();
  const [confirmAction, setConfirmAction] = useState<{
    next: OrderStatus;
    label: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const handleStatusChange = async () => {
    if (!confirmAction || !order) return;
    try {
      await updateStatus.mutateAsync({
        orderId: order.id,
        status: confirmAction.next,
      });
      setToast(`Estado actualizado: ${confirmAction.label}`);
      setConfirmAction(null);
    } catch {
      setToast("Error al actualizar estado");
    }
  };

  if (isLoading) {
    return (
      <Container className="min-h-screen bg-gray-50 p-4">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-40 w-full mb-4" />
        <Skeleton className="h-20 w-full mb-4" />
        <Skeleton className="h-32 w-full" />
      </Container>
    );
  }

  if (error || !order) {
    return (
      <Container className="min-h-screen bg-gray-50 p-4">
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-red-500 mb-4">No se pudo cargar la orden</p>
            <Button variant="primary" onClick={() => navigate("/dashboard")}>
              Volver al panel
            </Button>
          </CardContent>
        </Card>
      </Container>
    );
  }

  const availableActions = getAvailableActions(order.status);

  return (
    <Container className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#1B3A6B] text-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
            onClick={() => navigate("/dashboard")}
          >
            ← Volver
          </Button>
          <div>
            <h1 className="text-lg font-bold">{order.vehiclePlate}</h1>
            <p className="text-sm opacity-80">{order.vehicleModel}</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Status and Description */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">Estado actual</span>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="text-gray-700">{order.description}</p>
            <p className="text-xs text-gray-400 mt-2">
              OT #{order.id.slice(0, 8)} · Creada: {new Date(order.createdAt).toLocaleDateString("es-PE")}
            </p>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Historial de Estados</h2>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-3">
              {order.timeline.map((entry, idx) => (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        idx === 0 ? "bg-[#1B3A6B]" : "bg-gray-300"
                      }`}
                    />
                    {idx < order.timeline.length - 1 && (
                      <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
                    )}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm font-medium">
                      <OrderStatusBadge status={entry.status} />
                    </p>
                    <p className="text-xs text-gray-500">
                      {entry.mechanicName} ·{" "}
                      {new Date(entry.timestamp).toLocaleString("es-PE")}
                    </p>
                    {entry.notes && (
                      <p className="text-sm text-gray-600 mt-1">{entry.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Checklist */}
        {order.checklist.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Lista de Verificación</h2>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2">
                {order.checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-2 rounded bg-gray-50"
                  >
                    <StatusIndicator
                      status={item.completed ? "active" : "idle"}
                      size="sm"
                      label=""
                    />
                    <span
                      className={`text-sm ${
                        item.completed ? "text-gray-400 line-through" : "text-gray-700"
                      }`}
                    >
                      {item.description}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Parts Used */}
        {order.partsUsed.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Repuestos Utilizados</h2>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2">
                {order.partsUsed.map((part) => (
                  <div
                    key={part.id}
                    className="flex items-center justify-between p-2 rounded bg-gray-50"
                  >
                    <div>
                      <p className="text-sm font-medium">{part.name}</p>
                      <p className="text-xs text-gray-500">
                        Cant: {part.quantity} ·{" "}
                        <Badge variant="neutral">{part.status}</Badge>
                      </p>
                    </div>
                    {part.price > 0 && (
                      <p className="text-sm font-semibold">S/ {part.price.toFixed(2)}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Photos */}
        {order.photos.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">
                Fotos ({order.photos.length})
              </h2>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-2 gap-2">
                {order.photos.map((photo) => (
                  <div key={photo.id} className="relative">
                    <img
                      src={photo.url}
                      alt={photo.description}
                      className="w-full h-32 object-cover rounded-lg"
                      loading="lazy"
                    />
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {photo.description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 space-y-2">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="lg"
              className="flex-1 h-14"
              onClick={() => navigate(`/photo-upload?orderId=${order.id}`)}
            >
              Agregar Foto
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="flex-1 h-14"
              onClick={() => navigate(`/parts-request?orderId=${order.id}`)}
            >
              Pedir Repuestos
            </Button>
          </div>

          {availableActions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableActions.map((action) => (
                <Button
                  key={action.next}
                  variant="primary"
                  size="lg"
                  className="flex-1 h-14 text-sm"
                  onClick={() => setConfirmAction(action)}
                  disabled={updateStatus.isPending}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Confirm Dialog */}
      {confirmAction && (
        <ConfirmDialog
          open={true}
          title="Confirmar cambio de estado"
          description={`¿Está seguro de cambiar el estado a "${confirmAction.label}"?`}
          confirmLabel="Si, cambiar"
          cancelLabel="Cancelar"
          onConfirm={handleStatusChange}
          onClose={() => setConfirmAction(null)}
          isLoading={updateStatus.isPending}
        />
      )}

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 flex justify-center">
          <Toast variant="success" message={toast} />
        </div>
      )}
    </Container>
  );
}
