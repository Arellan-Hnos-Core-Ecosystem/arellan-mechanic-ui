import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Container, Card, CardHeader, CardContent,
  Button, Badge, Spinner, OrderStatusBadge, Skeleton, StatusIndicator,
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

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: "Recibido",
  IN_DIAGNOSIS: "En Diagnostico",
  BUDGETED: "Presupuestado",
  IN_PROGRESS: "En Progreso",
  IN_REVIEW: "En Revision",
  READY: "Listo para Entrega",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

const EVENT_ICONS: Record<string, string> = {
  STATUS_CHANGED: "🔄",
  PART_ADDED: "🔧",
  PART_REQUESTED: "🔧",
  PHOTO_UPLOADED: "📷",
  PHOTO_DELETED: "🗑️",
  PROGRESS_REPORTED: "📊",
  MECHANIC_PROGRESS: "📊",
};

function getAvailableActions(currentStatus: OrderStatus) {
  const flow: Record<OrderStatus, number> = {
    RECEIVED: 0, IN_DIAGNOSIS: 1, BUDGETED: 2, IN_PROGRESS: 3,
    IN_REVIEW: 4, READY: 5, DELIVERED: -1, CANCELLED: -1,
  };
  const current = flow[currentStatus];
  if (current < 0) return [];
  return STATUS_ACTIONS.filter((_, idx) => idx >= current);
}

function translateStatus(raw: string): string {
  return STATUS_LABEL[raw] ?? raw;
}

function translateError(err: unknown): string {
  let raw = "";
  if (err && typeof err === "object") {
    raw = (err as any).response?.data?.message
      ?? (err as any).response?.data?.error
      ?? (err as any).message
      ?? "";
  }
  if (typeof raw !== "string" || !raw) return "Error al actualizar estado";

  const replaced = Object.entries(STATUS_LABEL).reduce(
    (msg, [key, label]) => msg.replace(new RegExp(key, "gi"), label),
    raw,
  );
  return replaced;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: order, isLoading, error } = useOrder(id);
  const updateStatus = useUpdateStatus();
  const [confirmAction, setConfirmAction] = useState<{
    next: OrderStatus; label: string;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);
  const [visibleItems, setVisibleItems] = useState(5);
  const [deletePhotoTarget, setDeletePhotoTarget] = useState<{ photoId: string; url: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleStatusChange = async () => {
    if (!confirmAction || !order) return;
    try {
      await updateStatus.mutateAsync({
        orderId: order.id, status: confirmAction.next,
      });
      setToast({ message: `Estado actualizado: ${confirmAction.label}` });
      setConfirmAction(null);
    } catch (err) {
      setToast({ message: translateError(err) });
    }
  };

  const handleDeletePhoto = async () => {
    if (!deletePhotoTarget || !order) return;
    if (deletePhotoTarget.photoId.startsWith("legacy-")) {
      setDeletePhotoTarget(null);
      setToast({ message: "Foto eliminada correctamente" });
      return;
    }
    setDeleting(true);
    try {
      await api.delete(`/orders/${order.id}/photos/${deletePhotoTarget.photoId}`);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["orders", order.id] });
      setToast({ message: "Foto eliminada correctamente" });
      setDeletePhotoTarget(null);
    } catch {
      setToast({ message: "Error al eliminar la foto" });
    } finally {
      setDeleting(false);
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

  const isDelivered = order.status === "DELIVERED";

  const availableActions = getAvailableActions(order.status);
  const safePhotos = (order as any).photos ?? (order as any).photosRel ?? [];
  const statusHistory = (order as any).timeline ?? (order as any).statusHistory ?? [];
  const events = (order as any).events ?? [];
  const fullTimeline = [...statusHistory, ...events].sort(
    (a: any, b: any) =>
      new Date(b.timestamp ?? b.createdAt ?? 0).getTime() -
      new Date(a.timestamp ?? a.createdAt ?? 0).getTime(),
  );

  return (
    <Container className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-10 bg-[#1B3A6B] text-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => navigate("/dashboard")}>
            ← Volver
          </Button>
          <div>
            <h1 className="text-lg font-bold">{order.vehiclePlate}</h1>
            <p className="text-sm opacity-80">{order.vehicleBrand || ""} {order.vehicleModel}</p>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
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

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Bitacora de Actividad</h2>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-3">
              {fullTimeline.length === 0 && (
                <p className="text-sm text-gray-400">Sin registros en la bitacora</p>
              )}
              {fullTimeline.slice(0, visibleItems).map((entry: any, idx: number) => {
                const isHistory = "status" in entry && "changedBy" in entry;
                const isEvent = "event" in entry;
                const icon = isEvent ? EVENT_ICONS[entry.event] ?? "📌" : "🔄";
                const label = isHistory
                  ? translateStatus(entry.status)
                  : entry.description || entry.event || "";
                const who = entry.mechanicName ?? entry.changedBy ?? entry.userId ?? "";
                const ts = entry.timestamp ?? entry.createdAt;
                const dateStr = ts ? new Date(ts).toLocaleString("es-PE") : "";

                return (
                  <div key={entry.id || idx} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${idx === 0 ? "bg-[#1B3A6B] text-white" : "bg-gray-200"}`}>
                        {icon}
                      </div>
                      {idx < fullTimeline.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
                    </div>
                    <div className="pb-3 flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {isHistory ? <OrderStatusBadge status={entry.status} /> : label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {who}{dateStr ? ` · ${dateStr}` : ""}
                      </p>
                      {entry.notes && <p className="text-sm text-gray-600 mt-1">{entry.notes}</p>}
                    </div>
                  </div>
                );
              })}
              {fullTimeline.length > visibleItems && (
                <button
                  type="button"
                  onClick={() => setVisibleItems((prev) => prev + 5)}
                  className="w-full py-2.5 mt-2 rounded-lg bg-gray-100 text-sm font-medium text-[#1B3A6B] hover:bg-gray-200 active:bg-gray-300 transition-colors"
                  style={{ minHeight: "44px" }}
                >
                  Ver más ({fullTimeline.length - visibleItems} restantes)
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {(order.checklist ?? []).length > 0 && (
          <Card>
            <CardHeader><h2 className="text-base font-semibold">Lista de Verificacion</h2></CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2">
                {(order.checklist ?? []).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded bg-gray-50">
                    <StatusIndicator status={item.completed ? "active" : "idle"} size="sm" label="" />
                    <span className={`text-sm ${item.completed ? "text-gray-400 line-through" : "text-gray-700"}`}>
                      {item.description}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {(order.partsUsed ?? []).length > 0 && (
          <Card>
            <CardHeader><h2 className="text-base font-semibold">Repuestos Utilizados</h2></CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2">
                {(order.partsUsed ?? []).map((part) => (
                  <div key={part.id} className="flex items-center justify-between p-2 rounded bg-gray-50">
                    <div>
                      <p className="text-sm font-medium">{part.name}</p>
                      <p className="text-xs text-gray-500">
                        Cant: {part.quantity} · <Badge variant="neutral">{part.status}</Badge>
                      </p>
                    </div>
                    {part.price > 0 && (
                      <p className="text-sm font-semibold">S/ {Number(part.price || 0).toFixed(2)}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {safePhotos.length > 0 && (
          <Card>
            <CardHeader><h2 className="text-base font-semibold">Fotos ({safePhotos.length})</h2></CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-2 gap-2">
                {safePhotos.map((photo: any, idx: number) => {
                  const src = typeof photo === "string" ? photo
                    : (photo.url?.startsWith("http") || photo.url?.startsWith("data:") ? photo.url
                      : `http://localhost:3001${photo.url || ""}`);
                  const desc = typeof photo === "string" ? "" : (photo.description || photo.type || "");
                  const photoId = typeof photo === "string" ? `legacy-${idx}` : (photo.id || `legacy-${idx}`);
                  return (
                    <div key={photoId} className="relative group">
                      <div className="cursor-pointer active:scale-[0.97] transition-transform" onClick={() => setActivePhotoUrl(src)}>
                        <img src={src} alt={desc || "Foto"} className="w-full h-32 object-cover rounded-lg" loading="lazy" />
                        {desc && <p className="text-xs text-gray-500 mt-1 truncate">{desc}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletePhotoTarget({ photoId, url: src });
                        }}
                        className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full shadow hover:bg-red-700 active:scale-90 transition-all"
                        aria-label="Eliminar foto"
                        style={{ minWidth: "34px", minHeight: "34px" }}
                      >
                        🗑
                      </button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {isDelivered ? (
          <div className="fixed bottom-0 left-0 right-0 bg-amber-50 border-t border-amber-200 p-4">
            <div className="flex items-center justify-center gap-2 text-amber-800">
              <span className="text-lg">🔒</span>
              <p className="text-sm font-semibold text-center">
                Esta orden de trabajo se encuentra cerrada y entregada. Modo de solo lectura habilitado.
              </p>
            </div>
          </div>
        ) : (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 space-y-2">
            <div className="flex gap-2">
              <button type="button" onClick={() => navigate(`/orders/${order.id}/progress`)}
                className="flex-1 h-14 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:bg-indigo-800 transition-colors flex items-center justify-center min-h-[56px]">
                Reportar Avance
              </button>
              <button type="button" onClick={() => navigate(`/photo-upload?orderId=${order.id}`)}
                className="flex-1 h-14 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center min-h-[56px]">
                Agregar Foto
              </button>
              <button type="button" onClick={() => navigate(`/parts-request?orderId=${order.id}`)}
                className="flex-1 h-14 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 active:bg-amber-800 transition-colors flex items-center justify-center min-h-[56px]">
                Pedir Repuestos
              </button>
            </div>
            {availableActions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {availableActions.map((action) => (
                  <button key={action.next} type="button" onClick={() => setConfirmAction(action)} disabled={updateStatus.isPending}
                    className={`flex-1 h-14 text-sm font-semibold rounded-lg text-white transition-colors flex items-center justify-center min-h-[56px] disabled:opacity-50 disabled:cursor-not-allowed ${
                      action.next === "DELIVERED" ? "bg-green-600 hover:bg-green-700 active:bg-green-800"
                      : action.next === "READY" ? "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
                      : "bg-[#1B3A6B] hover:bg-[#152E54] active:bg-[#0F2240]"
                    }`}>
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900">Confirmar cambio de estado</h3>
            <p className="mt-2 text-sm text-gray-600">Esta seguro de cambiar el estado a "{confirmAction.label}"?</p>
            <div className="mt-6 flex gap-3 justify-end">
              <button type="button" onClick={() => setConfirmAction(null)}
                className="px-4 py-2.5 rounded-lg bg-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-300 active:bg-gray-400 transition-colors min-h-[44px]">
                Cancelar
              </button>
              <button type="button" onClick={handleStatusChange} disabled={updateStatus.isPending}
                className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 active:bg-emerald-800 transition-colors min-h-[44px] disabled:opacity-50">
                {updateStatus.isPending ? "Cambiando..." : "Si, cambiar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletePhotoTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl">🗑️</span>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Eliminar foto</h3>
                <p className="text-sm text-gray-500">Esta acción registra un evento en la bitácora</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">¿Estás seguro de eliminar esta foto del vehículo?</p>
            <div className="mt-6 flex gap-3 justify-end">
              <button type="button" onClick={() => setDeletePhotoTarget(null)} disabled={deleting}
                className="px-4 py-2.5 rounded-lg bg-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-300 active:bg-gray-400 transition-colors min-h-[44px]">
                Cancelar
              </button>
              <button type="button" onClick={handleDeletePhoto} disabled={deleting}
                className="px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 active:bg-red-800 transition-colors min-h-[44px] disabled:opacity-50">
                {deleting ? "Eliminando..." : "Si, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activePhotoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm" onClick={() => setActivePhotoUrl(null)}>
          <button type="button" onClick={() => setActivePhotoUrl(null)}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/20 text-white text-xl font-bold flex items-center justify-center hover:bg-white/30 transition-colors">
            ✕
          </button>
          <img src={activePhotoUrl} alt="Foto ampliada" className="max-w-full max-h-full object-contain p-4" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-4 right-4 flex justify-center z-40">
          <div className={`rounded-lg px-4 py-2.5 shadow-lg text-sm font-medium max-w-md ${
            toast.message.includes("Error") || toast.message.includes("saldo") || toast.message.includes("No se puede")
              ? "bg-red-50 text-red-800 border border-red-200"
              : "bg-green-50 text-green-800 border border-green-200"
          }`}>
            {toast.message}
          </div>
        </div>
      )}
    </Container>
  );
}
