import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { InventoryItem } from "@/types";
import { useOfflineStore } from "@/stores/offline";

export function useInventoryList() {
  const isOnline = useOfflineStore((s) => s.isOnline);

  return useQuery<InventoryItem[]>({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data } = await api.get("/inventory");
      if (Array.isArray(data)) return data;
      if (data && typeof data === "object" && Array.isArray((data as any).data)) return (data as any).data;
      return [];
    },
    staleTime: 60000,
    retry: 2,
    enabled: isOnline,
  });
}

export function useRequestParts() {
  const queryClient = useQueryClient();
  const { isOnline, enqueue } = useOfflineStore();

  return useMutation({
    mutationFn: async ({
      orderId,
      itemId,
      quantity,
    }: {
      orderId: string;
      itemId: string;
      quantity: number;
    }) => {
      if (!isOnline) {
        await enqueue({
          type: "REQUEST_PARTS",
          payload: { orderId, itemId, quantity },
        });
        return { offline: true };
      }
      const { data } = await api.post(`/orders/${orderId}/parts`, {
        itemId,
        quantity,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
