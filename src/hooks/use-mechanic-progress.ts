import { useRef, useCallback, useState, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { io, type Socket } from "socket.io-client"

const WS_URL =
  import.meta.env.VITE_WS_URL ?? "http://localhost:3001"

export interface MechanicProgressData {
  orderId: string
  orderNumber: string
  mechanicId: string
  mechanicName: string
  progressPercent: number
  currentStatus: string
  partsInstalled: number
  laborHours: number
  notes?: string
}

export function useMechanicProgress(token: string, mechanicId: string, mechanicName: string) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const mountedRef = useRef(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    mountedRef.current = true

    if (!token || token.length < 10) return

    const socket = io(WS_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      timeout: 10000,
    })

    socket.on("connect", () => {
      if (!mountedRef.current) return
      setConnected(true)
    })

    const onDisconnect = () => { if (mountedRef.current) setConnected(false) }
    const onError = () => { if (mountedRef.current) setConnected(false) }
    socket.on("disconnect", onDisconnect)
    socket.on("connect_error", onError)

    socketRef.current = socket

    return () => {
      mountedRef.current = false
      socket.off("connect")
      socket.off("disconnect", onDisconnect)
      socket.off("connect_error", onError)
      socket.disconnect()
      socketRef.current = null
    }
  }, [token])

  const sendProgress = useCallback(
    (data: Omit<MechanicProgressData, "mechanicId" | "mechanicName">) => {
      if (!socketRef.current?.connected) return
      socketRef.current.emit("mechanic:progress", {
        ...data,
        mechanicId,
        mechanicName,
        timestamp: new Date().toISOString(),
      })
      if (data.orderId) {
        queryClient.invalidateQueries({ queryKey: ["orders", data.orderId] })
      }
      queryClient.invalidateQueries({ queryKey: ["orders"] })
    },
    [mechanicId, mechanicName, queryClient],
  )

  return { connected, sendProgress }
}
