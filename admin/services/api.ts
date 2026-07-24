import axios from "axios";

const adminTokenKey = "vocab-battle-admin-token";

export const getAdminToken = () =>
  typeof window === "undefined" ? null : sessionStorage.getItem(adminTokenKey);

export const setAdminToken = (token: string) => sessionStorage.setItem(adminTokenKey, token);

export const api = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) config.headers.set("X-Admin-Token", token);
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) =>
    Promise.reject(
      new Error(error.response?.data?.message ?? error.message ?? "API error"),
    ),
);
