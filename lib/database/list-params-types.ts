// Shared types for paginated list params — safe to import on both client and server.

export interface ListParams {
  search?: string
  page?: number
  pageSize?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
}
