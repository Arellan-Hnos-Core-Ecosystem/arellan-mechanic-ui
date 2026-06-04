import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardContent, CardFooter, Button, Input, Spinner, Toast } from "@arellan-hnos-core-ecosystem/ui";
import { useAuthStore } from "@/stores/auth";

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "delete", "0", "enter"] as const;
const PIN_LENGTH = 6;

function BackspaceIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
      <line x1="18" y1="9" x2="12" y2="15" />
      <line x1="12" y1="9" x2="18" y2="15" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

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

      if (digit === "delete") {
        setPin((prev) => prev.slice(0, -1));
      } else if (digit === "enter") {
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

  const pinComplete = pin.length === PIN_LENGTH;

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
              const isDelete = digit === "delete";
              const isEnter = digit === "enter";

              if (isDelete) {
                return (
                  <Button
                    key="delete"
                    variant="outline"
                    size="lg"
                    className="h-14 flex items-center justify-center text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 active:bg-red-100"
                    onClick={() => handleDigit("delete")}
                    disabled={isLoading}
                    aria-label="Borrar digito"
                  >
                    <BackspaceIcon />
                  </Button>
                );
              }

              if (isEnter) {
                return (
                  <button
                    key="enter"
                    type="button"
                    onClick={() => handleDigit("enter")}
                    disabled={isLoading || !pinComplete}
                    aria-label="Ingresar PIN"
                    className={`h-14 flex items-center justify-center rounded-lg text-lg font-bold transition-colors min-h-[56px] ${
                      pinComplete
                        ? "bg-green-600 text-white hover:bg-green-700 active:bg-green-800 shadow-sm"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <CheckIcon />
                  </button>
                );
              }

              return (
                <Button
                  key={digit}
                  variant="outline"
                  size="lg"
                  className="h-14 text-lg font-semibold flex items-center justify-center"
                  onClick={() => handleDigit(digit)}
                  disabled={isLoading}
                  aria-label={`Digito ${digit}`}
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
