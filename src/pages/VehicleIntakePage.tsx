import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

const PERU_PLATE_REGEX = /^[A-Z]{1,3}\d{3,4}$/;

const schema = z.object({
  plate: z
    .string()
    .min(1, "La placa es obligatoria")
    .regex(PERU_PLATE_REGEX, "Formato inválido (ej: ABC123)"),
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
  const [ocrSimulating, setOcrSimulating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      fuelLevel: undefined,
      description: "",
    },
  });

  const simulateOcr = useCallback(async () => {
    setOcrSimulating(true);
    // Simulate OCR delay
    await new Promise((r) => setTimeout(r, 1500));
    setOcrSimulating(false);
    setToast({
      variant: "success",
      message: "Placa no detectada. Ingrese manualmente.",
    });
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
        message: "Debe capturar las 4 fotos del vehículo",
      });
      return;
    }

    const formData = new FormData();
    formData.append("plate", data.plate.toUpperCase());
    formData.append("kilometerReading", String(data.kilometerReading));
    formData.append("fuelLevel", data.fuelLevel);
    formData.append("description", data.description);
    photos.forEach((p) => {
      formData.append("photos", p.file);
      formData.append("photoPositions", p.position);
    });

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
                  onClick={simulateOcr}
                  disabled={ocrSimulating}
                  className="h-14 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center justify-center min-w-[96px]"
                >
                  {ocrSimulating ? <Spinner size="sm" /> : "Escanear"}
                </button>
              </div>
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
              Fotos del vehículo (4 obligatorias)
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

        {/* Submit */}
        <button
          type="submit"
          disabled={checkin.isPending}
          className="w-full h-14 text-lg font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 active:bg-green-800 transition-colors flex items-center justify-center shadow-sm"
        >
          {checkin.isPending ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" /> Guardando...
            </span>
          ) : (
            "Guardar Ingreso"
          )}
        </button>
      </form>

      {toast && (
        <div className="fixed bottom-4 left-4 right-4 flex justify-center">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}
    </Container>
  );
}
