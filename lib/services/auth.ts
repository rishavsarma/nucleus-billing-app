import { api } from "@/lib/axios"
import { createClient } from "@/lib/supabase/client"

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

export async function logout(): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
