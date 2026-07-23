"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import type { LobbyMessage, RoomInfo } from "@/types/type";

export function useRoomService(live = false, enabled = true) {
  const queryClient = useQueryClient();
  const roomsQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: async () => {
      const { data } = await api.get<RoomInfo[]>("/admin/rooms");
      return data;
    },
    enabled: enabled && !live,
    refetchInterval: enabled && !live ? 2000 : false,
  });

  useEffect(() => {
    if (!enabled || !live) return;

    let socket: WebSocket | null = null;
    let reconnectTimer = 0;
    let closed = false;

    const connect = () => {
      socket = new WebSocket(
        `${process.env.NEXT_PUBLIC_WS_URL ?? ""}/ws/lobby`,
      );
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as LobbyMessage;
          if (message.type === "ROOMS_UPDATE") {
            queryClient.setQueryData(["rooms"], message.payload ?? []);
          }
        } catch {
          // Ignore malformed lobby messages and keep the connection alive.
        }
      };
      socket.onclose = () => {
        if (!closed) reconnectTimer = window.setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      closed = true;
      window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [enabled, live, queryClient]);

  return {
    rooms: roomsQuery.data ?? [],
    loading: roomsQuery.isPending,
    error: roomsQuery.error,
    refreshRooms: roomsQuery.refetch,
  };
}
