import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Tesseract from "tesseract.js";
import {
  Container,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Input,
  Spinner,
  Toast,
  Select,
  FormField,
} from "@arellan-hnos-core-ecosystem/ui";
import { useVehicleCheckin } from "@/hooks/use-orders";

const PERU_PLATE_REGEX = /^[A-Z]{3}-\d{3}$/i;

const schema = z.object({
  plate: z
    .string()
    .min(1, "La placa es obligatoria")
    .regex(PERU_PLATE_REGEX, "Formato inválido. Use ABC-123"),
  brand: z
    .string()
    .min(1, "La marca es obligatoria"),
  model: z
    .string()
    .min(1, "El modelo es obligatorio"),
  kilometerReading: z
    .number({ invalid_type_error: "Debe ser un número" })
    .min(0, "No puede ser negativo")
    .max(999999, "Valor fuera de rango"),
  fuelLevel: z.enum(["EMPTY", "QUARTER", "HALF", "THREE_QUARTERS", "FULL"], {
    errorMap: () => ({ message: "Seleccione el nivel de combustible" }),
  }),
  description: z.string().min(1, "La descripción es obligatoria"),
});

type FormData = z.infer<typeof schema>;

const FUEL_LEVELS = [
  { value: "EMPTY", label: "Vacío" },
  { value: "QUARTER", label: "1/4" },
  { value: "HALF", label: "1/2" },
  { value: "THREE_QUARTERS", label: "3/4" },
  { value: "FULL", label: "Lleno" },
];

const PHOTO_POSITIONS = [
  { key: "FRONT", label: "Frente" },
  { key: "BACK", label: "Atrás" },
  { key: "LEFT", label: "Lado Izquierdo" },
  { key: "RIGHT", label: "Lado Derecho" },
  { key: "DASHBOARD", label: "Tablero" },
] as const;

export default function VehicleIntakePage() {
  const navigate = useNavigate();
  const checkin = useVehicleCheckin();
  const [photos, setPhotos] = useState<
    { file: File; position: string; preview: string }[]
  >([]);
  const [toast, setToast] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [activePhotoPosition, setActivePhotoPosition] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      plate: "",
      brand: "",
      model: "",
      fuelLevel: undefined,
      description: "",
    },
  });

  const openScanner = useCallback(async () => {
    try {
      setScannerOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 150);
    } catch {
      setScannerOpen(false);
      setToast({
        variant: "error",
        message: "No se pudo acceder a la cámara. Ingrese la placa manualmente.",
      });
    }
  }, []);

  const closeScanner = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScannerOpen(false);
    setCapturing(false);
  }, []);

  const capturePlate = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setCapturing(true);
    setIsProcessing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo obtener contexto 2D");

      ctx.drawImage(video, 0, 0);

      const guideWidth = 280;
      const guideHeight = 140;
      const sx = (canvas.width - guideWidth) / 2;
      const sy = (canvas.height - guideHeight) / 2;

      const imageData = ctx.getImageData(sx, sy, guideWidth, guideHeight);
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = guideWidth;
      cropCanvas.height = guideHeight;
      const cropCtx = cropCanvas.getContext("2d");
      if (!cropCtx) throw new Error("No se pudo obtener contexto de recorte");
      cropCtx.putImageData(imageData, 0, 0);

      const dataUrl = cropCanvas.toDataURL("image/jpeg", 0.9);

      const result = await Tesseract.recognize(dataUrl, "eng", {
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-",
      } as any);

      const text = result.data.text.replace(/\s+/g, "").toUpperCase();
      const confidence = result.data.confidence;

      if (PERU_PLATE_REGEX.test(text) && confidence >= 70) {
        setValue("plate", text, { shouldValidate: true });
        closeScanner();
        setToast({
          variant: "success",
          message: `Placa detectada: ${text}`,
        });
      } else {
        closeScanner();
        setToast({
          variant: "error",
          message: "⚠️ Poca visibilidad o placa no legible. Por favor, ingrésela manualmente.",
        });
      }
    } catch {
      closeScanner();
      setToast({
        variant: "error",
        message: "⚠️ Poca visibilidad o placa no legible. Por favor, ingrésela manualmente.",
      });
    } finally {
      setCapturing(false);
      setIsProcessing(false);
    }
  }, [setValue, closeScanner]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handlePhotoCapture = (position: string) => {
    setActivePhotoPosition(position);
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePhotoPosition) return;

    const preview = URL.createObjectURL(file);
    setPhotos((prev) => {
      const filtered = prev.filter((p) => p.position !== activePhotoPosition);
      return [...filtered, { file, position: activePhotoPosition, preview }];
    });
    setActivePhotoPosition(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (position: string) => {
    setPhotos((prev) => prev.filter((p) => p.position !== position));
  };

  const allPhotosCaptured = PHOTO_POSITIONS.every((p) =>
    photos.some((photo) => photo.position === p.key)
  );

  const onSubmit = async (data: FormData) => {
    if (!allPhotosCaptured) {
      setToast({
        variant: "error",
        message: "Debe capturar las 5 fotos del vehículo",
      });
      return;
    }

    const formData = new FormData();
    formData.append("plate", data.plate.toUpperCase());
    formData.append("brand", data.brand);
    formData.append("model", data.model);
    formData.append("kilometerReading", String(data.kilometerReading));
    formData.append("fuelLevel", data.fuelLevel);
    formData.append("description", data.description);
    formData.append("photoPositions", photos.map((p) => p.position).join(","));
    photos.forEach((p) => formData.append("photos", p.file));

    try {
      await checkin.mutateAsync(formData);
      setToast({ variant: "success", message: "Vehículo ingresado exitosamente" });
      setTimeout(() => navigate("/dashboard"), 1500);
    } catch {
      setToast({ variant: "error", message: "Error al ingresar vehículo" });
    }
  };

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
          <h1 className="text-lg font-bold">Ingreso de Vehículo</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
        {/* Plate */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <FormField label="Placa del vehículo" error={errors.plate?.message}>
              <div className="flex gap-2">
                <Input
                  id="placa-del-vehiculo"
                  {...register("plate")}
                  placeholder="ABC123"
                  className="flex-1 uppercase text-lg font-mono tracking-wider text-center h-14"
                  maxLength={7}
                  autoCapitalize="characters"
                />
                <button
                  type="button"
                  onClick={openScanner}
                  className="h-14 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center min-w-[96px]"
                >
                  Escanear
                </button>
              </div>
            </FormField>

            <FormField label="Marca del vehículo" error={errors.brand?.message}>
              <Input
                id="marca-del-vehiculo"
                {...register("brand")}
                placeholder="Toyota"
                className="text-lg h-14"
              />
            </FormField>

            <FormField label="Modelo del vehículo" error={errors.model?.message}>
              <Input
                id="modelo-del-vehiculo"
                {...register("model")}
                placeholder="Hiace"
                className="text-lg h-14"
              />
            </FormField>
          </CardContent>
        </Card>

        {/* Kilometers and Fuel */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <FormField
              label="Kilometraje actual"
              error={errors.kilometerReading?.message}
            >
              <Input
                id="kilometraje-actual"
                {...register("kilometerReading", { valueAsNumber: true })}
                type="number"
                placeholder="0"
                inputMode="numeric"
                className="text-lg text-center h-14"
              />
            </FormField>

            <FormField label="Nivel de combustible" error={errors.fuelLevel?.message}>
              <Controller
                control={control}
                name="fuelLevel"
                render={({ field }) => (
                  <Select
                    id="nivel-de-combustible"
                    value={field.value || ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    className="h-14"
                    options={[
                      { value: "", label: "Seleccionar nivel...", disabled: true },
                      ...FUEL_LEVELS.map((f) => ({ value: f.value, label: f.label })),
                    ]}
                  />
                )}
              />
            </FormField>
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardContent className="p-4">
            <FormField
              label="Descripción del trabajo"
              error={errors.description?.message}
            >
              <Input
                id="descripcion-del-trabajo"
                {...register("description")}
                placeholder="Describa el trabajo a realizar..."
                className="text-base h-14"
              />
            </FormField>
          </CardContent>
        </Card>

        {/* Photos */}
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">
              Fotos del vehículo (5 obligatorias)
            </h2>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-2 gap-3">
              {PHOTO_POSITIONS.map((pos) => {
                const photo = photos.find((p) => p.position === pos.key);
                return (
                  <div key={pos.key} className="flex flex-col items-center">
                    <div
                      className={`w-full aspect-video rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${
                        photo
                          ? "border-green-500 bg-green-50"
                          : "border-gray-300 bg-gray-50 hover:border-[#1B3A6B]"
                      }`}
                      onClick={() => {
                        if (!photo) handlePhotoCapture(pos.key);
                      }}
                    >
                      {photo ? (
                        <div className="relative w-full h-full">
                          <img
                            src={photo.preview}
                            alt={pos.label}
                            className="w-full h-full object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              removePhoto(pos.key);
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center text-gray-400">
                          <span className="text-2xl">📷</span>
                          <span className="text-xs mt-1">{pos.label}</span>
                        </div>
                      )}
                    </div>
                    {photo && (
                      <p className="text-xs text-green-600 mt-1 font-medium">
                        {pos.label} ✓
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Hidden file input for camera */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />
          </CardContent>
        </Card>

        {/* Submit — min-h-[56px] satisfies touch target for nitrile-gloved mechanics */}
        <Button
          type="submit"
          data-testid="submit-order"
          disabled={checkin.isPending || !allPhotosCaptured}
          variant="primary"
          size="lg"
          className="w-full min-h-[56px] text-lg font-semibold"
        >
          {checkin.isPending ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" /> Guardando...
            </span>
          ) : (
            "Guardar Ingreso"
          )}
        </Button>
      </form>

      {toast && (
        <div className="fixed bottom-4 left-4 right-4 flex justify-center">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}

      {scannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[280px] h-[140px] border-4 border-green-400 rounded-lg opacity-70 shadow-[0_0_30px_rgba(74,222,128,0.5)]" />
          </div>

          <p className="absolute top-[25%] left-0 right-0 text-center text-white text-lg font-semibold drop-shadow-lg">
            Guía de Enfoque de Placa
          </p>

          <div className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-4 px-6">
            {isProcessing && (
              <div className="flex items-center gap-3 bg-black/60 backdrop-blur-sm rounded-full px-6 py-3">
                <Spinner size="sm" />
                <span className="text-white text-base font-medium">
                  🔍 Analizando caracteres de la placa...
                </span>
              </div>
            )}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={closeScanner}
                disabled={isProcessing}
                className="h-14 px-8 rounded-full bg-white/20 text-white font-semibold hover:bg-white/30 active:bg-white/40 transition-colors backdrop-blur-sm disabled:opacity-30"
              >
                Cerrar Escáner
              </button>
              <button
                type="button"
                onClick={capturePlate}
                disabled={capturing}
                className="h-14 px-8 rounded-full bg-green-500 text-white font-semibold hover:bg-green-600 active:bg-green-700 transition-colors shadow-lg disabled:opacity-50"
              >
                {capturing ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" /> Procesando...
                  </span>
                ) : (
                  "Capturar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}
