"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import { decryptCardPayload } from "@/lib/card-payload";
import type {
  Card,
  CardForm,
  CardQuery,
  CardUpdate,
  PagedResult,
} from "@/types/type";

export function useCardService(query: CardQuery) {
  const queryClient = useQueryClient();
  const cardsQuery = useQuery({
    queryKey: ["cards", query],
    queryFn: async () => {
      const { data } = await api.get<{ iv: string; ciphertext: string }>("/cards", {
        params: {
          ...query,
          categoryId: query.categoryId || undefined,
          search: query.search || undefined,
        },
      });
      return decryptCardPayload<PagedResult<Card>>(data);
    },
  });
  const invalidateCards = () =>
    queryClient.invalidateQueries({ queryKey: ["cards"] });
  const createCard = useMutation({
    mutationFn: (card: CardForm) => api.post<Card>("/cards", card),
    onSuccess: invalidateCards,
  });
  const updateCard = useMutation({
    mutationFn: ({ id, card }: CardUpdate) =>
      api.put<Card>(`/cards/${id}`, card),
    onSuccess: invalidateCards,
  });
  const deleteCard = useMutation({
    mutationFn: (id: string) => api.delete(`/cards/${id}`),
    onSuccess: invalidateCards,
  });

  return {
    cards: cardsQuery.data?.items ?? [],
    total: cardsQuery.data?.total ?? 0,
    totalPages: cardsQuery.data?.total_pages ?? 0,
    loading: cardsQuery.isPending,
    saving: createCard.isPending || updateCard.isPending,
    refreshCards: cardsQuery.refetch,
    createCard: createCard.mutateAsync,
    updateCard: updateCard.mutateAsync,
    deleteCard: deleteCard.mutateAsync,
  };
}
