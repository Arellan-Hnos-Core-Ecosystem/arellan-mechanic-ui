import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import QRCode from "qrcode";
import { z } from "zod";
import api from "@/lib/api";
import {
  Container, Card, CardHeader, CardContent,
  Button, Badge, Spinner, OrderStatusBadge, Skeleton, StatusIndicator,
} from "@arellan-hnos-core-ecosystem/ui";
import { useOrder, useUpdateStatus, useCompleteWorkOrder } from "@/hooks/use-orders";
import { useAuthStore } from "@/stores/auth";
import type { Order, OrderStatus } from "@/types";

const STATUS_ACTIONS: Record<OrderStatus, { next: OrderStatus; label: string; color: string } | null> = {
  RECEIVED:     { next: "IN_DIAGNOSIS", label: "Iniciar Diagnostico", color: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800" },
  IN_DIAGNOSIS: { next: "BUDGETED",      label: "Presupuestar",        color: "bg-amber-600 hover:bg-amber-700 active:bg-amber-800" },
  BUDGETED:     { next: "IN_PROGRESS",   label: "Iniciar Trabajo",      color: "bg-orange-600 hover:bg-orange-700 active:bg-orange-800" },
  IN_PROGRESS:  { next: "IN_REVIEW",     label: "Enviar a Revision",    color: "bg-purple-600 hover:bg-purple-700 active:bg-purple-800" },
  // QA: la aprobacion IN_REVIEW -> READY es exclusiva del Jefe de Taller en arellan-frontend-web
  IN_REVIEW:    null,
  READY:        { next: "DELIVERED",     label: "Entregar Vehiculo",    color: "bg-green-700 hover:bg-green-800 active:bg-green-900" },
  DELIVERED:    null,
  CANCELLED:    null,
};

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

function getNextAction(currentStatus: OrderStatus): { next: OrderStatus; label: string; color: string } | null {
  return STATUS_ACTIONS[currentStatus] ?? null;
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

const completeWorkOrderSchema = (odometerIn: number | null) =>
  z.object({
    odometerOut: z
      .number({ invalid_type_error: "Ingrese un kilometraje valido" })
      .int("El kilometraje debe ser un numero entero")
      .min(0, "El kilometraje no puede ser negativo")
      .refine((val) => odometerIn === null || val >= odometerIn, {
        message:
          odometerIn !== null
            ? `El kilometraje de salida debe ser mayor o igual al de ingreso (${odometerIn} km)`
            : "Kilometraje invalido",
      }),
    technicalNotes: z
      .string()
      .trim()
      .min(5, "Describa el trabajo realizado (minimo 5 caracteres)"),
  });

type CompleteFormErrors = { odometerOut?: string; technicalNotes?: string };

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: order, isLoading, error } = useOrder(id);
  const updateStatus = useUpdateStatus();
  const completeWorkOrder = useCompleteWorkOrder();
  const [confirmAction, setConfirmAction] = useState<{
    next: OrderStatus; label: string;
  } | null>(null);
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [completeOdometer, setCompleteOdometer] = useState("");
  const [completeNotes, setCompleteNotes] = useState("");
  const [completeErrors, setCompleteErrors] = useState<CompleteFormErrors>({});
  const [showTraineeQaWarning, setShowTraineeQaWarning] = useState(false);
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);
  const [visibleItems, setVisibleItems] = useState(5);
  const [deletePhotoTarget, setDeletePhotoTarget] = useState<{ photoId: string; url: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const signatureRef = useRef<HTMLCanvasElement>(null);
  const sigDrawing = useRef(false);
  const socketRef = useRef<Socket | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const mechanic = useAuthStore((s) => s.mechanic);
  const token = useAuthStore((s) => s.accessToken);
  const isTrainee = mechanic?.role === "TRAINEE";

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!id || !token) return;

    const socket = io(import.meta.env.VITE_WS_URL || "http://localhost:3001", {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
    });

    socket.on("connect", () => {
      socket.emit("order:subscribe", { orderId: id });
    });

    socket.on("order:updated", () => {
      queryClient.invalidateQueries({ queryKey: ["orders", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    });

    socket.on("order:status_changed", () => {
      queryClient.invalidateQueries({ queryKey: ["orders", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    });

    socketRef.current = socket;

    return () => {
      socket.emit("order:unsubscribe", { orderId: id });
      socket.off("connect");
      socket.off("order:updated");
      socket.off("order:status_changed");
      socket.off("mechanic:progress");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [id, token, queryClient]);

  useEffect(() => {
    if (!order || order.status !== "READY") return;
    const total = order as any;
    const amount = Number(total.totalCost ?? total.finalAmount ?? 0).toFixed(2);
    const qrText = `ARELAN|${order.id.slice(0, 8)}|${amount}|PEN`;
    QRCode.toDataURL(qrText, { width: 200, margin: 2, color: { dark: "#1B3A6B" } })
      .then((url: string) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null));
  }, [order]);

  const startSignature = useCallback(() => {
    setShowSignature(true);
    setSignatureData(null);
    setTimeout(() => {
      const canvas = signatureRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
      }
    }, 100);
  }, []);

  const handleSigStart = useCallback((e: React.PointerEvent) => {
    sigDrawing.current = true;
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    canvas.setPointerCapture(e.pointerId);
  }, []);

  const handleSigMove = useCallback((e: React.PointerEvent) => {
    if (!sigDrawing.current) return;
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  }, []);

  const handleSigEnd = useCallback((e: React.PointerEvent) => {
    sigDrawing.current = false;
    const canvas = signatureRef.current;
    if (!canvas) return;
    canvas.releasePointerCapture(e.pointerId);
  }, []);

  const clearSignature = useCallback(() => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const confirmSignature = useCallback(() => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    setSignatureData(canvas.toDataURL("image/png"));
    setShowSignature(false);
  }, []);

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

  const openCompleteForm = () => {
    setCompleteOdometer(order?.odometerIn != null ? String(order.odometerIn) : "");
    setCompleteNotes("");
    setCompleteErrors({});
    setShowCompleteForm(true);
  };

  const validateCompleteForm = (): { odometerOut: number; technicalNotes: string } | null => {
    if (!order) return null;
    const result = completeWorkOrderSchema(order.odometerIn).safeParse({
      odometerOut: Number(completeOdometer),
      technicalNotes: completeNotes,
    });
    if (!result.success) {
      const fieldErrors: CompleteFormErrors = {};
      for (const issue of result.error.issues) {
        if (issue.path[0] === "odometerOut") fieldErrors.odometerOut = issue.message;
        if (issue.path[0] === "technicalNotes") fieldErrors.technicalNotes = issue.message;
      }
      setCompleteErrors(fieldErrors);
      return null;
    }
    setCompleteErrors({});
    return result.data;
  };

  const submitCompletion = async (
    requestedStatus: "READY" | "IN_REVIEW",
    data: { odometerOut: number; technicalNotes: string },
  ) => {
    if (!order) return;
    try {
      await completeWorkOrder.mutateAsync({ orderId: order.id, requestedStatus, ...data });
      setToast({
        message:
          requestedStatus === "READY"
            ? "Trabajo finalizado. OT lista para entrega."
            : "OT enviada a revision del Jefe de Taller.",
      });
      setShowCompleteForm(false);
      setShowTraineeQaWarning(false);
    } catch (err) {
      setToast({ message: translateError(err) });
      setShowTraineeQaWarning(false);
    }
  };

  const handleFinalize = () => {
    const data = validateCompleteForm();
    if (!data) return;
    void submitCompletion("READY", data);
  };

  const handleSendToReview = () => {
    const data = validateCompleteForm();
    if (!data) return;
    if (isTrainee) {
      setShowTraineeQaWarning(true);
      return;
    }
    void submitCompletion("IN_REVIEW", data);
  };

  const handleConfirmTraineeReview = () => {
    const data = validateCompleteForm();
    if (!data) return;
    void submitCompletion("IN_REVIEW", data);
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
  const isInProgress = order.status === "IN_PROGRESS";
  const isReady = order.status === "READY";

  const nextAction = getNextAction(order.status);
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
              <div data-testid="order-status">
                <OrderStatusBadge status={order.status} />
              </div>
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

        {isReady && qrDataUrl && (
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Pago de Liquidación</h2>
            </CardHeader>
            <CardContent className="p-4 pt-0 flex flex-col items-center space-y-3">
              <div data-testid="payment-qr" className="bg-white p-3 rounded-lg border border-gray-200">
                <img src={qrDataUrl} alt="QR de pago" className="w-48 h-48" />
              </div>
              <p className="text-xs text-gray-500 text-center">
                Escanee este QR con Yape o Plin para pagar el monto exacto de la liquidación
              </p>
              <canvas ref={qrCanvasRef} className="hidden" />
            </CardContent>
          </Card>
        )}

        {isReady && (
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Firma Digital del Cliente</h2>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {signatureData ? (
                <div className="space-y-2">
                  <img src={signatureData} alt="Firma del cliente" className="w-full h-32 object-contain rounded-lg border border-gray-200 bg-white" />
                  <button type="button" onClick={startSignature}
                    className="w-full py-2 rounded-lg bg-gray-100 text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors min-h-[44px]">
                    Volver a firmar
                  </button>
                </div>
              ) : (
                <button type="button" onClick={startSignature}
                  className="w-full h-14 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center min-h-[48px]">
                  ✍️ Firmar Entrega
                </button>
              )}
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
        ) : order.status === "IN_REVIEW" ? (
          <div className="fixed bottom-0 left-0 right-0 bg-purple-50 border-t border-purple-200 p-4">
            <div className="flex items-center justify-center gap-2 text-purple-800">
              <span className="text-lg">🔍</span>
              <p className="text-sm font-semibold text-center">
                OT en revision de calidad. Esperando aprobacion del Jefe de Taller.
              </p>
            </div>
          </div>
        ) : (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-2 grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
            {isInProgress && (
              <>
                <button type="button" onClick={() => navigate(`/orders/${order.id}/progress`)}
                  className="rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:bg-indigo-800 transition-colors flex items-center justify-center min-h-[48px]">
                  Reportar Avance
                </button>
                <button type="button" onClick={() => navigate(`/photo-upload?orderId=${order.id}`)}
                  className="rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center min-h-[48px]">
                  Agregar Foto
                </button>
                <button type="button" onClick={() => navigate(`/parts-request?orderId=${order.id}`)}
                  className="rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 active:bg-amber-800 transition-colors flex items-center justify-center min-h-[48px]">
                  Pedir Repuestos
                </button>
              </>
            )}
            {nextAction && (
              <>
                {nextAction.next === "IN_REVIEW" ? (
                  <button
                    type="button"
                    data-testid="complete-work"
                    onClick={openCompleteForm}
                    className={`rounded-lg text-white text-sm font-semibold transition-colors flex items-center justify-center min-h-[48px] ${nextAction.color} col-span-2 md:col-span-1`}
                  >
                    Finalizar Trabajo
                  </button>
                ) : nextAction.next === "DELIVERED" && isTrainee ? (
                  <div className="col-span-2 md:col-span-3">
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-lg bg-gray-400 text-white text-sm font-semibold flex items-center justify-center min-h-[48px] cursor-not-allowed"
                    >
                      🔒 Entregar Vehículo (Requiere autorización de Mecánico)
                    </button>
                    <p className="text-xs text-gray-500 text-center mt-1">
                      Los practicantes no pueden cerrar órdenes. Solicite ayuda a un mecánico autorizado.
                    </p>
                  </div>
                ) : nextAction.next === "DELIVERED" && !signatureData ? (
                  <div className="col-span-2 md:col-span-3">
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-lg bg-gray-400 text-white text-sm font-semibold flex items-center justify-center min-h-[48px] cursor-not-allowed"
                    >
                      ✍️ Se requiere firma del cliente para entregar
                    </button>
                  </div>
                ) : (
                  <button
                    key={nextAction.next}
                    type="button"
                    data-testid={nextAction.next === "DELIVERED" ? "submit-order" : undefined}
                    onClick={() => setConfirmAction(nextAction)}
                    disabled={updateStatus.isPending}
                    className={`rounded-lg text-white text-sm font-semibold transition-colors flex items-center justify-center min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed ${nextAction.color} ${isInProgress ? "col-span-2 md:col-span-1" : "col-span-2 md:col-span-3"}`}
                  >
                    {nextAction.label}
                  </button>
                )}
              </>
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

      {showCompleteForm && order && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900">Finalizar Trabajo</h3>
            <p className="mt-1 text-sm text-gray-600">
              Registra el kilometraje de salida y describe el trabajo realizado.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kilometraje de salida (km)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={completeOdometer}
                  onChange={(e) => setCompleteOdometer(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#1B3A6B] focus:ring-1 focus:ring-[#1B3A6B] outline-none"
                  style={{ minHeight: "44px" }}
                  placeholder="Ej. 85120"
                  data-testid="odometer-out-input"
                />
                {order.odometerIn != null && (
                  <p className="text-xs text-gray-400 mt-1">Kilometraje de ingreso: {order.odometerIn} km</p>
                )}
                {completeErrors.odometerOut && (
                  <p className="text-xs text-red-600 mt-1">{completeErrors.odometerOut}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas tecnicas del trabajo
                </label>
                <textarea
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-[#1B3A6B] focus:ring-1 focus:ring-[#1B3A6B] outline-none resize-none"
                  placeholder="Describa el trabajo ejecutado, repuestos cambiados, pruebas realizadas..."
                  data-testid="technical-notes-input"
                />
                {completeErrors.technicalNotes && (
                  <p className="text-xs text-red-600 mt-1">{completeErrors.technicalNotes}</p>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2">
              {isTrainee ? (
                <button
                  type="button"
                  onClick={handleSendToReview}
                  disabled={completeWorkOrder.isPending}
                  data-testid="send-to-review"
                  className="w-full px-4 py-2.5 rounded-lg bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 active:bg-purple-800 transition-colors min-h-[44px] disabled:opacity-50"
                >
                  {completeWorkOrder.isPending ? "Enviando..." : "Enviar a Revision"}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleFinalize}
                    disabled={completeWorkOrder.isPending}
                    data-testid="finalize-ready"
                    className="w-full px-4 py-2.5 rounded-lg bg-green-600 text-white font-semibold text-sm hover:bg-green-700 active:bg-green-800 transition-colors min-h-[44px] disabled:opacity-50"
                  >
                    {completeWorkOrder.isPending ? "Procesando..." : "Finalizar (Listo para Entrega)"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendToReview}
                    disabled={completeWorkOrder.isPending}
                    data-testid="send-to-review"
                    className="w-full px-4 py-2.5 rounded-lg bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 active:bg-purple-800 transition-colors min-h-[44px] disabled:opacity-50"
                  >
                    Enviar a Revision QA
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setShowCompleteForm(false)}
                disabled={completeWorkOrder.isPending}
                className="w-full px-4 py-2.5 rounded-lg bg-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-300 active:bg-gray-400 transition-colors min-h-[44px]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showTraineeQaWarning && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-xl">⚠️</span>
              <h3 className="text-lg font-bold text-gray-900">Se requiere aprobacion del Jefe de Taller</h3>
            </div>
            <p className="text-sm text-gray-600">
              Como practicante, esta OT sera enviada a revision. El Jefe de Taller (Juan) debe inspeccionar
              el trabajo y firmar digitalmente la aprobacion de control de calidad antes de liberar el
              vehiculo al cliente.
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowTraineeQaWarning(false)} disabled={completeWorkOrder.isPending}
                className="px-4 py-2.5 rounded-lg bg-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-300 active:bg-gray-400 transition-colors min-h-[44px]">
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmTraineeReview} disabled={completeWorkOrder.isPending}
                className="px-4 py-2.5 rounded-lg bg-purple-600 text-white font-semibold text-sm hover:bg-purple-700 active:bg-purple-800 transition-colors min-h-[44px] disabled:opacity-50">
                {completeWorkOrder.isPending ? "Enviando..." : "Entendido, enviar a revision"}
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

      {showSignature && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white">
          <div className="bg-[#1B3A6B] text-white px-4 py-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Firma del Cliente</h2>
            <button type="button" onClick={() => setShowSignature(false)}
              className="text-white hover:text-gray-200 text-sm font-semibold">
              Cancelar
            </button>
          </div>
          <div className="flex-1 bg-gray-100 p-4 flex flex-col">
            <p className="text-sm text-gray-500 mb-2 text-center">Firme con el dedo en el recuadro</p>
            <div className="flex-1 rounded-lg border-2 border-dashed border-gray-300 bg-white overflow-hidden">
              <canvas
                ref={signatureRef}
                className="w-full h-full touch-none"
                style={{ minHeight: "300px" }}
                onPointerDown={handleSigStart}
                onPointerMove={handleSigMove}
                onPointerUp={handleSigEnd}
                onPointerLeave={handleSigEnd}
              />
            </div>
            <div className="flex gap-3 mt-4">
              <button type="button" onClick={clearSignature}
                className="flex-1 h-14 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 active:bg-gray-400 transition-colors min-h-[48px]">
                Limpiar Trazo
              </button>
              <button type="button" onClick={confirmSignature}
                className="flex-1 h-14 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 active:bg-green-800 transition-colors min-h-[48px]">
                Confirmar Firma
              </button>
            </div>
          </div>
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
