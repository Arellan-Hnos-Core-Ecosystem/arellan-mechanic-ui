import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Container,
  Card,
  CardHeader,
  CardContent,
  Button,
  Input,
  Spinner,
  Toast,
  FormField,
} from "@arellan-hnos-core-ecosystem/ui";

export default function PhotoUploadPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      setCameraActive(true);

      // Wait for next tick to set video src
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch {
      setToast({
        variant: "error",
        message: "No se pudo acceder a la cámara. Use el botón de subir archivo.",
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const url = canvas.toDataURL("image/jpeg", 0.85);
    setPreview(url);
    stopCamera();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!preview) return;

    setUploading(true);
    try {
      const blob = await (await fetch(preview)).blob();
      const formData = new FormData();
      formData.append("photo", blob, `photo-${Date.now()}.jpg`);
      formData.append("description", description);
      if (orderId) formData.append("orderId", orderId);

      const { default: api } = await import("@/lib/api");
      await api.post("/photos/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setToast({ variant: "success", message: "Foto subida exitosamente" });
      setPreview(null);
      setDescription("");

      if (orderId) {
        setTimeout(() => navigate(`/orders/${orderId}`), 1200);
      }
    } catch {
      setToast({ variant: "error", message: "Error al subir la foto" });
    } finally {
      setUploading(false);
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
            onClick={() => navigate(-1)}
          >
            ← Volver
          </Button>
          <h1 className="text-lg font-bold">
            {orderId ? "Agregar Foto a OT" : "Subir Foto"}
          </h1>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Camera Section */}
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold">Cámara</h2>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            {cameraActive ? (
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full rounded-lg bg-black"
                  style={{ minHeight: 300 }}
                />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                  <Button
                    variant="primary"
                    size="lg"
                    className="h-14 px-8 rounded-full"
                    onClick={capturePhoto}
                  >
                    Capturar
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="h-14 px-8 rounded-full"
                    onClick={stopCamera}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="primary"
                size="lg"
                className="w-full h-14"
                onClick={startCamera}
              >
                📷 Abrir Cámara
              </Button>
            )}

            <canvas ref={canvasRef} className="hidden" />

            <div className="text-center text-sm text-gray-400">o</div>

            <Button
              variant="secondary"
              size="lg"
              className="w-full h-14"
              onClick={() => fileInputRef.current?.click()}
            >
              📁 Subir desde archivo
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </CardContent>
        </Card>

        {/* Preview */}
        {preview && (
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Vista previa</h2>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <img
                src={preview}
                alt="Preview"
                className="w-full rounded-lg object-cover"
                style={{ maxHeight: 400 }}
              />

              <FormField label="Descripción de la foto">
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Filtro de aceite dañado..."
                  className="h-14"
                />
              </FormField>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="lg"
                  className="flex-1 h-14"
                  onClick={() => setPreview(null)}
                >
                  Descartar
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1 h-14"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <span className="flex items-center gap-2">
                      <Spinner size="sm" /> Subiendo...
                    </span>
                  ) : (
                    "Subir Foto"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-4 left-4 right-4 flex justify-center">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}
    </Container>
  );
}
