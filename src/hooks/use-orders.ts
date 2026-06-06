import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Order } from "@/types";
import { useOfflineStore } from "@/stores/offline";
import { useAuthStore } from "@/stores/auth";

export interface PaginatedOrders {
  data: Order[];
  nextCursor: string | null;
}

function useOfflineFallback<T>(key: string[], fn: () => Promise<T>, enabled = true) {
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
    enabled,
  });
}

function extractOrders(raw: unknown): Order[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as Order[];
    if (Array.isArray(obj.orders)) return obj.orders as Order[];
  }
  return [];
}

export function useMyOrders() {
  const mechanicId = useAuthStore((s) => s.mechanic?.id);
  const token = useAuthStore((s) => s.accessToken);

  return useQuery<Order[]>({
    queryKey: ["orders", "my", mechanicId ?? ""],
    queryFn: async () => {
      const { data } = await api.get("/orders/my");
      return extractOrders(data);
    },
    staleTime: 30000,
    retry: 2,
    refetchInterval: 30000,
    enabled: !!mechanicId && !!token,
  });
}

export function useOrder(orderId: string | undefined) {
  const token = useAuthStore((s) => s.accessToken);
  return useOfflineFallback<Order>(["orders", orderId ?? ""], async () => {
    const { data } = await api.get(`/orders/${orderId}`);
    return data;
  }, !!orderId && !!token);
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
      const { data } = await api.post(`/orders/${orderId}/status`, {
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
