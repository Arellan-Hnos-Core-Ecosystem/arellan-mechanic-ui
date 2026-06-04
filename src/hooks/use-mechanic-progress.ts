import { useRef, useCallback, useState, useEffect } from "react"
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

  useEffect(() => {
    if (!token) return

    const socket = io(WS_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    })

    socket.on("connect", () => {
      setConnected(true)
      socket.emit("order:subscribe")
    })

    socket.on("disconnect", () => {
      setConnected(false)
    })

    socketRef.current = socket

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [token])

  const sendProgress = useCallback(
    (data: Omit<MechanicProgressData, "mechanicId" | "mechanicName">) => {
      socketRef.current?.emit("mechanic:progress", {
        ...data,
        mechanicId,
        mechanicName,
        timestamp: new Date().toISOString(),
      })
    },
    [mechanicId, mechanicName],
  )

  return { connected, sendProgress }
}
