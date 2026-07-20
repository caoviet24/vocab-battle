"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/services/api";
import type {
  Category,
  CategoryForm,
  CategoryUpdate,
} from "@/types/type";

export function useCategoryService() {
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await api.get<Category[]>("/categories");
      return data;
    },
  });
  const invalidateCategories = () =>
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  const createCategory = useMutation({
    mutationFn: ({ name, description, image_url }: CategoryForm) =>
      api.post<Category>("/categories", { name, description, image_url }),
    onSuccess: invalidateCategories,
  });
  const updateCategory = useMutation({
    mutationFn: ({ id, name, description, image_url }: CategoryUpdate) =>
      api.put<Category>(`/categories/${id}`, { name, description, image_url }),
    onSuccess: invalidateCategories,
  });
  const deleteCategory = useMutation({
    mutationFn: (id: string) => api.delete(`/categories/${id}`),
    onSuccess: invalidateCategories,
  });

  return {
    categories: categoriesQuery.data ?? [],
    loading: categoriesQuery.isPending,
    saving: createCategory.isPending || updateCategory.isPending,
    refreshCategories: categoriesQuery.refetch,
    createCategory: createCategory.mutateAsync,
    updateCategory: updateCategory.mutateAsync,
    deleteCategory: deleteCategory.mutateAsync,
  };
}
