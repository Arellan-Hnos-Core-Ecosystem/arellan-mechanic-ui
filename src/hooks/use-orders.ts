import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Order } from "@/types";
import { useOfflineStore } from "@/stores/offline";
import { useAuthStore } from "@/stores/auth";

function useOfflineFallback<T>(key: string[], fn: () => Promise<T>) {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const queryClient = useQueryClient();

  return useQuery<T>({
    queryKey: key,
    queryFn: async () => {
      if (!isOnline) {
        const cached = queryClient.getQueryData<T>(key);
        if (cached) return cached;
      }
      return fn();
    },
    staleTime: 30000,
    retry: 2,
    refetchInterval: isOnline ? 30000 : false,
  });
}

export function useMyOrders() {
  const mechanicId = useAuthStore((s) => s.mechanic?.id);

  return useOfflineFallback<Order[]>(["orders", "my", mechanicId ?? ""], async () => {
    const { data } = await api.get("/orders/assigned");
    return data;
  });
}

export function useOrder(orderId: string | undefined) {
  return useOfflineFallback<Order>(["orders", orderId ?? ""], async () => {
    const { data } = await api.get(`/orders/${orderId}`);
    return data;
  });
}

export function useUpdateStatus() {
  const queryClient = useQueryClient();
  const { isOnline, enqueue } = useOfflineStore();

  return useMutation({
    mutationFn: async ({
      orderId,
      status,
      notes,
    }: {
      orderId: string;
      status: string;
      notes?: string;
    }) => {
      if (!isOnline) {
        await enqueue({
          type: "UPDATE_STATUS",
          payload: { orderId, status, notes },
        });
        return { offline: true };
      }
      const { data } = await api.patch(`/orders/${orderId}/status`, {
        status,
        notes,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useVehicleCheckin() {
  const queryClient = useQueryClient();
  const { isOnline, enqueue } = useOfflineStore();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      if (!isOnline) {
        const plate = formData.get("plate") as string;
        const items = formData.getAll("photos");
        await enqueue({
          type: "VEHICLE_INTAKE",
          payload: { plate, photosCount: items.length },
        });
        return { offline: true };
      }
      const { data } = await api.post("/orders/checkin", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
