import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Spinner,
  Toast,
} from "@arellan-hnos-core-ecosystem/ui";
import { useAuthStore } from "@/stores/auth";
import api from "@/lib/api";

type AttendanceAction = "check-in" | "check-out" | null;

export default function CheckInPage() {
  const navigate = useNavigate();
  const { mechanic, checkSession } = useAuthStore();
  const [action, setAction] = useState<AttendanceAction>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmedAction, setConfirmedAction] = useState<{
    type: "check-in" | "check-out";
    timestamp: string;
  } | null>(null);
  const [toast, setToast] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    if (!checkSession() || !mechanic) {
      navigate("/login", { replace: true });
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAttendance = async (type: "check-in" | "check-out") => {
    if (!mechanic) return;

    setAction(type);
    setIsLoading(true);

    try {
      await api.post(`/personnel/${mechanic.id}/attendance/${type}`);
      const now = new Date();
      setConfirmedAction({
        type,
        timestamp: now.toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      });
      setToast({
        variant: "success",
        message: type === "check-in" ? "Entrada registrada exitosamente" : "Salida registrada exitosamente",
      });
    } catch {
      setToast({
        variant: "error",
        message: type === "check-in" ? "Error al registrar entrada" : "Error al registrar salida",
      });
    } finally {
      setIsLoading(false);
      setAction(null);
    }
  };

  if (!mechanic) {
    return null;
  }

  const today = currentTime.toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const timeString = currentTime.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <Container className="min-h-screen bg-gray-50 pb-24">
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
          <h1 className="text-lg font-bold">Control de Asistencia</h1>
        </div>
      </header>

      <main className="p-4 space-y-6">
        <Card>
          <CardHeader>
            <div className="text-center">
              <p className="text-sm text-gray-500 capitalize-first">{today}</p>
              <p className="mt-1 text-4xl font-bold text-gray-900 tracking-wider font-mono">
                {timeString}
              </p>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="text-center">
              <div className="mx-auto mb-3 w-16 h-16 rounded-full bg-[#1B3A6B] flex items-center justify-center">
                <span className="text-white text-xl font-bold">
                  {mechanic.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")}
                </span>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">{mechanic.name}</h2>
              <p className="text-sm text-gray-500">
                {mechanic.role === "MECHANIC" ? "Mecánico" : "Aprendiz"}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {confirmedAction && (
              <div
                className={`rounded-lg p-4 text-center ${
                  confirmedAction.type === "check-in"
                    ? "bg-green-50 border border-green-200"
                    : "bg-blue-50 border border-blue-200"
                }`}
              >
                <p
                  className={`text-lg font-semibold ${
                    confirmedAction.type === "check-in" ? "text-green-700" : "text-blue-700"
                  }`}
                >
                  {confirmedAction.type === "check-in" ? "Entrada" : "Salida"} registrada
                </p>
                <p className="mt-1 text-3xl font-bold text-gray-900 font-mono">
                  {confirmedAction.timestamp}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {confirmedAction.type === "check-in"
                    ? "Ha marcado su ingreso exitosamente"
                    : "Ha marcado su salida exitosamente"}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="primary"
                size="lg"
                className="h-20 text-xl font-bold bg-green-600 hover:bg-green-700"
                onClick={() => handleAttendance("check-in")}
                disabled={isLoading}
              >
                {isLoading && action === "check-in" ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" /> Registrando...
                  </span>
                ) : (
                  "CHECK-IN"
                )}
              </Button>

              <Button
                variant="secondary"
                size="lg"
                className="h-20 text-xl font-bold border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => handleAttendance("check-out")}
                disabled={isLoading}
              >
                {isLoading && action === "check-out" ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" /> Registrando...
                  </span>
                ) : (
                  "CHECK-OUT"
                )}
              </Button>
            </div>
          </CardContent>

          <CardFooter className="text-center text-xs text-gray-400">
            <p className="w-full">Recuerde marcar su entrada y salida diariamente</p>
          </CardFooter>
        </Card>
      </main>

      {toast && (
        <div className="fixed bottom-4 left-4 right-4 flex justify-center">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}
    </Container>
  );
}
