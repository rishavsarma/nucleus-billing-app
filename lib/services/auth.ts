import { api } from "@/lib/axios"

export interface LoginInput {
  email: string
  password: string
}

export interface LoginResult {
  user: { id: string; email?: string }
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const { data } = await api.post<LoginResult>("/auth/login", input)
  return data
}
