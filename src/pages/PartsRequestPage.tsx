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
  const [toast, setToast] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);

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

  const onSubmit = async (data: FormData) => {
    try {
      await requestParts.mutateAsync(data);
      setToast({
        variant: "success",
        message: "Solicitud de repuestos enviada",
      });
      reset({ orderId: data.orderId, itemId: "", quantity: undefined });
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
                          label: `[${order.vehiclePlate}] ${order.vehicleModel} (#${order.id.slice(0, 6)})`,
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
                {selectedOrder.vehiclePlate} - {selectedOrder.vehicleModel}
              </p>
              <p className="text-sm text-gray-600 line-clamp-2">
                {selectedOrder.description}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <button
          type="submit"
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
    </Container>
  );
}
