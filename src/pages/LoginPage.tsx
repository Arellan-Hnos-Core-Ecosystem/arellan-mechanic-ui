import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardContent, CardFooter, Button, Input, Spinner, Toast } from "@arellan-hnos-core-ecosystem/ui";
import { useAuthStore } from "@/stores/auth";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "Borrar", "0", "Entrar"];
const PIN_LENGTH = 6;

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const { login, isLoading, error, checkSession, mechanic } = useAuthStore();
  const navigate = useNavigate();
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (checkSession() && mechanic) {
      navigate("/dashboard", { replace: true });
    }
  }, []);

  useEffect(() => {
    if (error) {
      setShowError(true);
      const t = setTimeout(() => setShowError(false), 4000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handleDigit = useCallback(
    (digit: string) => {
      if (isLoading) return;

      if (digit === "Borrar") {
        setPin((prev) => prev.slice(0, -1));
      } else if (digit === "Entrar") {
        if (pin.length === PIN_LENGTH) {
          login(pin).then((ok) => {
            if (ok) navigate("/dashboard", { replace: true });
          });
        }
      } else {
        setPin((prev) => (prev.length < PIN_LENGTH ? prev + digit : prev));
      }
    },
    [pin, isLoading, login, navigate]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#1B3A6B] to-[#0F2440] p-4">
      <Card className="w-full max-w-md mx-auto shadow-xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-3 w-16 h-16 rounded-full bg-[#1B3A6B] flex items-center justify-center">
            <span className="text-white text-2xl font-bold">AH</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Arellan Hnos</h1>
          <p className="text-sm text-gray-500 mt-1">Ingrese su PIN de acceso</p>
        </CardHeader>

        <CardContent className="pb-4">
          <div className="flex justify-center gap-2 mb-6">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                className={`w-10 h-10 rounded-md border-2 flex items-center justify-center transition-colors ${
                  pin.length > i
                    ? "border-[#1B3A6B] bg-[#1B3A6B]"
                    : "border-gray-300 bg-gray-50"
                }`}
              >
                {pin.length > i && (
                  <div className="w-3 h-3 rounded-full bg-white" />
                )}
              </div>
            ))}
          </div>

          {isLoading && (
            <div className="flex justify-center mb-4">
              <Spinner size="md" />
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {DIGITS.map((digit) => {
              const isSpecial = digit === "Borrar" || digit === "Entrar";
              const isEnter = digit === "Entrar";
              const isDelete = digit === "Borrar";

              return (
                <Button
                  key={digit}
                  variant={isEnter ? "primary" : isDelete ? "secondary" : "outline"}
                  size="lg"
                  className={`h-14 text-lg font-semibold ${
                    isEnter && pin.length < PIN_LENGTH ? "opacity-50" : ""
                  } ${isDelete ? "text-sm" : ""}`}
                  onClick={() => handleDigit(digit)}
                  disabled={isLoading || (isEnter && pin.length < PIN_LENGTH)}
                >
                  {digit}
                </Button>
              );
            })}
          </div>
        </CardContent>

        <CardFooter className="text-center text-xs text-gray-400 pt-0">
          <p className="w-full">Sistema exclusivo para personal del taller</p>
        </CardFooter>
      </Card>

      {showError && (
        <div className="fixed bottom-6 left-4 right-4 flex justify-center">
          <Toast variant="error" message={error || "PIN incorrecto"} />
        </div>
      )}
    </div>
  );
}
