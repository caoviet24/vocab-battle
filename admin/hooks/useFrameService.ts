"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import type { Frame, FrameForm, FrameUpdate } from "@/types/type";

export function useFrameService() {
  const queryClient = useQueryClient();
  const framesQuery = useQuery({ queryKey: ["frames"], queryFn: async () => (await api.get<Frame[]>("/frames")).data });
  const invalidateFrames = () => queryClient.invalidateQueries({ queryKey: ["frames"] });
  const createFrame = useMutation({ mutationFn: (frame: FrameForm) => api.post<Frame>("/frames", frame), onSuccess: invalidateFrames });
  const updateFrame = useMutation({ mutationFn: ({ id, ...frame }: FrameUpdate) => api.put<Frame>(`/frames/${id}`, frame), onSuccess: invalidateFrames });
  const deleteFrame = useMutation({ mutationFn: (id: string) => api.delete(`/frames/${id}`), onSuccess: invalidateFrames });

  return {
    frames: framesQuery.data ?? [],
    loading: framesQuery.isPending,
    saving: createFrame.isPending || updateFrame.isPending,
    refreshFrames: framesQuery.refetch,
    createFrame: createFrame.mutateAsync,
    updateFrame: updateFrame.mutateAsync,
    deleteFrame: deleteFrame.mutateAsync,
  };
}
