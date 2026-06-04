import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  CardHeader,
  CardContent,
  Button,
  Spinner,
  OrderStatusBadge,
  Skeleton,
} from "@arellan-hnos-core-ecosystem/ui";
import { useOrder } from "@/hooks/use-orders";
import { useMechanicProgress } from "@/hooks/use-mechanic-progress";
import { useAuthStore } from "@/stores/auth";

const PROGRESS_PRESETS = [
  { label: "Iniciando", value: 10 },
  { label: "Diagnostico", value: 25 },
  { label: "Trabajando", value: 50 },
  { label: "Casi listo", value: 75 },
  { label: "Revision", value: 90 },
  { label: "Terminado", value: 100 },
];

const PART_COUNTS = [0, 1, 2, 3, 4, 5, 8, 10];
const HOUR_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];

export default function MechanicProgressPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading } = useOrder(id);
  const mechanic = useAuthStore((s) => s.mechanic);
  const token = useAuthStore((s) => s.accessToken);

  const { connected, sendProgress } = useMechanicProgress(
    token ?? "",
    mechanic?.id ?? "",
    mechanic?.name ?? "Mecanico",
  );

  const [progress, setProgress] = useState(50);
  const [partsInstalled, setPartsInstalled] = useState(0);
  const [laborHours, setLaborHours] = useState(1);
  const [notes, setNotes] = useState("");
  const [sent, setSent] = useState(false);

  const handleSend = useCallback(() => {
    if (!order) return;
    sendProgress({
      orderId: order.id,
      orderNumber: order.id.slice(0, 8),
      currentStatus: order.status,
      progressPercent: progress,
      partsInstalled,
      laborHours,
      notes: notes.trim() || undefined,
    });
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  }, [order, sendProgress, progress, partsInstalled, laborHours, notes]);

  if (isLoading) {
    return (
      <Container className="min-h-screen bg-gray-50 p-4">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-32 w-full mb-4" />
        <Skeleton className="h-64 w-full" />
      </Container>
    );
  }

  if (!order) {
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

  return (
    <Container className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-10 bg-[#1B3A6B] text-white px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
            onClick={() => navigate(`/orders/${order.id}`)}
          >
            ← Volver
          </Button>
          <div>
            <h1 className="text-lg font-bold">Reportar Avance</h1>
            <p className="text-sm opacity-80">{order.vehiclePlate} · {order.vehicleModel}</p>
          </div>
          {connected && (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-300">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              En vivo
            </span>
          )}
        </div>
      </header>

      <main className="p-4 space-y-5">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Estado Actual</h2>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">OT #{order.id.slice(0, 8)}</span>
              <OrderStatusBadge status={order.status} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Porcentaje de Avance</h2>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-3xl font-bold text-[#1B3A6B]">{progress}%</span>
              <div className="flex-1">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                  style={{ accentColor: "#1B3A6B" }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {PROGRESS_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setProgress(preset.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    progress === preset.value
                      ? "bg-[#1B3A6B] text-white"
                      : "bg-gray-100 text-gray-600 active:bg-gray-200"
                  }`}
                  style={{ minHeight: "44px", touchAction: "manipulation" }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Repuestos Instalados</h2>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-4 gap-2">
              {PART_COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPartsInstalled(n)}
                  className={`py-3 rounded-lg text-sm font-semibold transition-colors ${
                    partsInstalled === n
                      ? "bg-[#1B3A6B] text-white"
                      : "bg-gray-100 text-gray-700 active:bg-gray-200"
                  }`}
                  style={{ minHeight: "48px", touchAction: "manipulation" }}
                >
                  {n}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Horas de Trabajo</h2>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-5 gap-2">
              {HOUR_OPTIONS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setLaborHours(h)}
                  className={`py-3 rounded-lg text-sm font-semibold transition-colors ${
                    laborHours === h
                      ? "bg-[#1B3A6B] text-white"
                      : "bg-gray-100 text-gray-700 active:bg-gray-200"
                  }`}
                  style={{ minHeight: "48px", touchAction: "manipulation" }}
                >
                  {h}h
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Notas del Avance</h2>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <textarea
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent"
              rows={3}
              placeholder="Ej: Se cambio la bomba de agua, falta ajustar la faja..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ minHeight: "80px" }}
            />
          </CardContent>
        </Card>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3">
        <Button
          variant="primary"
          size="lg"
          className="w-full h-14 text-base font-semibold"
          onClick={handleSend}
          disabled={!connected}
          style={{ backgroundColor: sent ? "#16a34a" : "#1B3A6B" }}
        >
          {sent ? "Avance Enviado!" : "Enviar Reporte de Avance"}
        </Button>
      </div>
    </Container>
  );
}
