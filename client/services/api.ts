import axios from "axios";

export const api = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) =>
    Promise.reject(
      new Error(error.response?.data?.message ?? error.message ?? "API error"),
    ),
);
