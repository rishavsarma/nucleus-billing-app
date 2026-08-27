import { createClient } from "@/lib/supabase/client"

export interface ProfileDetails {
  email: string | null
  name: string | null
  phone: string | null
}

/** Reads name/phone straight off the Supabase auth user (user_metadata), not a billing table. */
export async function fetchProfile(): Promise<ProfileDetails> {
  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) throw error
  return {
    email: user?.email ?? null,
    name: (user?.user_metadata?.full_name as string | undefined) ?? null,
    phone: (user?.user_metadata?.phone as string | undefined) ?? null,
  }
}

export async function updateProfileDetails(input: { name: string; phone: string | null }): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.auth.updateUser({
    data: { full_name: input.name, phone: input.phone },
  })
  if (error) throw error
}

/** Supabase emails a confirmation link to the new address; the change isn't live until that's clicked. */
export async function updateEmail(email: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.auth.updateUser({ email })
  if (error) throw error
}

export async function updatePassword(password: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}
