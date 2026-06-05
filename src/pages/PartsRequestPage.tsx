import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Container,
  Card,
  CardHeader,
  CardContent,
  Button,
  Input,
  Spinner,
  Toast,
  Select,
  FormField,
  CashAmount,
  EmptyState,
} from "@arellan-hnos-core-ecosystem/ui";
import { useMyOrders } from "@/hooks/use-orders";
import { useInventoryList, useRequestParts } from "@/hooks/use-inventory";
import { useAuthStore } from "@/stores/auth";

const schema = z.object({
  orderId: z.string().min(1, "Seleccione una orden de trabajo"),
  itemId: z.string().min(1, "Seleccione un repuesto"),
  quantity: z
    .number({ invalid_type_error: "Debe ser un número" })
    .min(1, "Mínimo 1")
    .max(99, "Máximo 99"),
});

type FormData = z.infer<typeof schema>;

export default function PartsRequestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedOrderId = searchParams.get("orderId") || undefined;

  const { data: rawOrders, isLoading: ordersLoading } = useMyOrders();
  const orders = rawOrders ?? [];
  const { data: inventoryRaw, isLoading: inventoryLoading } = useInventoryList();
  const inventory = Array.isArray(inventoryRaw) ? inventoryRaw : (Array.isArray((inventoryRaw as any)?.data) ? (inventoryRaw as any).data : []);
  const requestParts = useRequestParts();
  const mechanic = useAuthStore((s) => s.mechanic);
  const isTrainee = mechanic?.role === "TRAINEE";
  const [toast, setToast] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);
  const [confirmSend, setConfirmSend] = useState<FormData | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      orderId: preselectedOrderId || "",
      itemId: "",
    },
  });

  const selectedOrderId = watch("orderId");
  const selectedItemId = watch("itemId");
  const quantity = watch("quantity") || 0;

  const selectedOrder = useMemo(
    () => orders?.find((o) => o.id === selectedOrderId),
    [orders, selectedOrderId]
  );

  const selectedItem = useMemo(
    () => inventory?.find((i: { id: string }) => i.id === selectedItemId),
    [inventory, selectedItemId]
  );

  const totalCost = selectedItem ? selectedItem.unitPrice * quantity : 0;

  // Filter orders that are in progress
  const activeOrders = useMemo(
    () =>
      orders?.filter(
        (o) => o.status !== "DELIVERED" && o.status !== "CANCELLED"
      ) || [],
    [orders]
  );

  const onSubmit = (data: FormData) => {
    setConfirmSend(data);
  };

  const handleConfirmedSend = async () => {
    if (!confirmSend) return;
    const data = confirmSend;
    setConfirmSend(null);
    try {
      await requestParts.mutateAsync(data);
      setToast({
        variant: "success",
        message: "Solicitud de repuestos enviada",
      });
      reset({ orderId: data.orderId, itemId: "", quantity: undefined });

      if (preselectedOrderId) {
        setTimeout(() => {
          navigate(`/orders/${data.orderId}`, { replace: true });
        }, 3000);
      } else {
        navigate("/dashboard", { replace: true });
      }
    } catch {
      setToast({
        variant: "error",
        message: "Error al solicitar repuestos",
      });
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
          <h1 className="text-lg font-bold">Solicitar Repuestos</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
        {/* Select Order */}
        <Card>
          <CardContent className="p-4">
            <FormField label="Orden de Trabajo" error={errors.orderId?.message}>
              {ordersLoading ? (
                <div className="flex items-center gap-2 h-14">
                  <Spinner size="sm" />
                  <span className="text-sm text-gray-500">Cargando órdenes...</span>
                </div>
              ) : activeOrders.length === 0 ? (
                <EmptyState title="Sin órdenes activas" description="No hay órdenes pendientes para solicitar repuestos." />
              ) : (
                <Controller
                  control={control}
                  name="orderId"
                  render={({ field }) => (
                    <Select
                      id="orden-de-trabajo"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="h-14"
                      options={[
                        { value: "", label: "Seleccionar OT...", disabled: true },
                        ...activeOrders.map((order) => ({
                          value: order.id,
                          label: `[${order.vehiclePlate}] ${order.vehicleBrand || ""} ${order.vehicleModel} (#${order.id.slice(0, 6)})`,
                        })),
                      ]}
                    />
                  )}
                />
              )}
            </FormField>
          </CardContent>
        </Card>

        {/* Select Item */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <FormField label="Repuesto" error={errors.itemId?.message}>
              {inventoryLoading ? (
                <div className="flex items-center gap-2 h-14">
                  <Spinner size="sm" />
                  <span className="text-sm text-gray-500">Cargando inventario...</span>
                </div>
              ) : !inventory || inventory.length === 0 ? (
                <EmptyState title="Inventario no disponible" description="No se pudo cargar el inventario de repuestos." />
              ) : (
                <Controller
                  control={control}
                  name="itemId"
                  render={({ field }) => (
                    <Select
                      id="repuesto"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="h-14"
                      options={[
                        { value: "", label: "Seleccionar repuesto...", disabled: true },
                        ...inventory.map((item: { id: string; name: string; code: string; stock: number; unitPrice: number }) => ({
                          value: item.id,
                          label: `${item.name} (${item.code}) - Stock: ${item.stock} - S/${Number(item.unitPrice || 0).toFixed(2)}`,
                          disabled: item.stock <= 0,
                        })),
                      ]}
                    />
                  )}
                />
              )}
            </FormField>

            {selectedItem && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">{selectedItem.name}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Código: {selectedItem.code} · Stock disponible: {selectedItem.stock} · Categoría:{" "}
                  {selectedItem.category}
                </p>
                {(selectedItem as any).minStock !== undefined && selectedItem.stock <= ((selectedItem as any).minStock || 5) && (
                  <div className="mt-2 flex items-center gap-1.5 p-2 rounded bg-amber-100 border border-amber-300">
                    <span className="text-xs">⚠️</span>
                    <p className="text-xs font-medium text-amber-800">
                      Stock crítico: solo {selectedItem.stock} unidad(es). Podría retrasar la reparación.
                    </p>
                  </div>
                )}
              </div>
            )}

            <FormField label="Cantidad" error={errors.quantity?.message || (selectedItem && quantity > selectedItem.stock ? "Solo esta disponible desde 1 unidad hasta el stock existente" : undefined)}>
              <Input
                id="cantidad"
                {...register("quantity", { valueAsNumber: true })}
                type="number"
                placeholder="0"
                inputMode="numeric"
                min={1}
                max={selectedItem?.stock || 99}
                className="text-lg text-center h-14"
              />
            </FormField>

            {totalCost > 0 && (
              <div className="flex justify-end">
                <CashAmount amount={totalCost} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Summary */}
        {selectedOrder && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">Resumen de OT</p>
              <p className="font-medium">
                [{selectedOrder.vehiclePlate}] {selectedOrder.vehicleBrand || ""} {selectedOrder.vehicleModel}
              </p>
              <p className="text-sm text-gray-600 line-clamp-2">
                {selectedOrder.description}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Trainee Warning */}
        {isTrainee && selectedItem && totalCost > 500 && (
          <Card>
            <CardContent className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">Aprobación Requerida</p>
                  <p className="text-xs text-amber-700">
                    Como practicante, las solicitudes superiores a S/500 requieren aprobación de un mecánico o administrador.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <button
          type="submit"
          data-testid="submit-order"
          disabled={requestParts.isPending || !selectedOrderId || !selectedItemId || !quantity || (selectedItem && quantity > selectedItem.stock)}
          className="w-full h-14 text-lg font-semibold rounded-lg bg-slate-700 text-white hover:bg-slate-800 active:bg-slate-900 transition-colors flex items-center justify-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {requestParts.isPending ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" /> Enviando...
            </span>
          ) : (
            "Enviar Solicitud"
          )}
        </button>
      </form>

      {toast && (
        <div className="fixed bottom-4 left-4 right-4 flex justify-center">
          <Toast variant={toast.variant} message={toast.message} />
        </div>
      )}

      {confirmSend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-xl">🔧</span>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Confirmar solicitud</h3>
                <p className="text-sm text-gray-500">Esta acción descuenta del inventario</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              ¿Confirmas el envío de esta solicitud de repuestos al inventario?
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmSend(null)}
                disabled={requestParts.isPending}
                className="px-4 py-2.5 rounded-lg bg-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-300 active:bg-gray-400 transition-colors min-h-[44px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmedSend}
                disabled={requestParts.isPending}
                className="px-4 py-2.5 rounded-lg bg-slate-700 text-white font-semibold text-sm hover:bg-slate-800 active:bg-slate-900 transition-colors min-h-[44px] disabled:opacity-50"
              >
                {requestParts.isPending ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" /> Enviando...
                  </span>
                ) : (
                  "Si, enviar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}
