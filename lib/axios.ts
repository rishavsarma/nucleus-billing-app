import * as Sentry from "@sentry/nextjs"
import axios from "axios"

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    Sentry.captureException(error)
    return Promise.reject(error)
  },
)
