"use client"

import { useState } from "react"
import { isAxiosError } from "axios"
import { Loader2Icon } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { useRouter } from "@/i18n/navigation"
import { useLogin } from "@/hooks/use-login"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const t = useTranslations("LoginForm")
  const router = useRouter()
  const login = useLogin()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  // Known, locale-independent error codes get a translated message; anything
  // else (e.g. a Supabase error we haven't mapped) falls back to the raw
  // (English) message the server sent, since we can't translate text we
  // don't control.
  const knownErrors: Record<string, string> = {
    invalid_credentials: t("invalidCredentials"),
    invalid_email: t("invalidEmail"),
    password_required: t("passwordRequired"),
  }

  const errorBody = isAxiosError<{ error: string; code?: string }>(login.error)
    ? login.error.response?.data
    : null
  const error = errorBody
    ? (errorBody.code && knownErrors[errorBody.code]) ||
      errorBody.error ||
      t("genericError")
    : null

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    login.mutate(
      { email, password },
      {
        onSuccess: () => {
          router.push("/dashboard/overview")
          router.refresh()
        },
        onError: (mutationError) => {
          if (!isAxiosError(mutationError)) {
            toast.error(t("networkError"))
          }
        },
      }
    )
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-balance text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="email">{t("emailLabel")}</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder={t("emailPlaceholder")}
            required
            autoComplete="email"
            className="bg-background"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={!!error}
          />
        </Field>
        <Field data-invalid={!!error}>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">{t("passwordLabel")}</FieldLabel>
            <a
              href="#"
              className="ms-auto text-sm underline-offset-4 hover:underline"
            >
              {t("forgotPassword")}
            </a>
          </div>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            className="bg-background"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={!!error}
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
        <Field>
          <Button type="submit" disabled={login.isPending}>
            {login.isPending ? <Loader2Icon className="animate-spin" /> : null}
            {t("submit")}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
