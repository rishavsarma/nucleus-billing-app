"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useProfile,
  useUpdateEmail,
  useUpdatePassword,
  useUpdateProfileDetails,
} from "@/hooks/use-profile"

const detailsSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
})
type DetailsFormValues = z.infer<typeof detailsSchema>

const emailSchema = z.object({
  email: z.string().email(),
})
type EmailFormValues = z.infer<typeof emailSchema>

const passwordSchema = z
  .object({
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "passwordsDontMatch",
    path: ["confirmPassword"],
  })
type PasswordFormValues = z.infer<typeof passwordSchema>

export default function ProfilePage() {
  const t = useTranslations("Profile")
  const tFields = useTranslations("PartyFields")
  const tCommon = useTranslations("Common")

  const { data: profile, isLoading } = useProfile()
  const updateDetails = useUpdateProfileDetails()
  const updateEmail = useUpdateEmail()
  const updatePassword = useUpdatePassword()

  const detailsForm = useForm<DetailsFormValues>({
    resolver: zodResolver(detailsSchema),
    values: { name: profile?.name ?? "", phone: profile?.phone ?? "" },
  })
  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    values: { email: profile?.email ?? "" },
  })
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  function onSubmitDetails(values: DetailsFormValues) {
    updateDetails.mutate(
      { name: values.name, phone: values.phone || null },
      {
        onSuccess: () => toast.success(tCommon("updatedSuccess")),
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  function onSubmitEmail(values: EmailFormValues) {
    updateEmail.mutate(values.email, {
      onSuccess: () => toast.success(t("emailChangeConfirmSent")),
      onError: () => toast.error(tCommon("genericError")),
    })
  }

  function onSubmitPassword(values: PasswordFormValues) {
    updatePassword.mutate(values.password, {
      onSuccess: () => {
        toast.success(t("passwordChanged"))
        passwordForm.reset({ password: "", confirmPassword: "" })
      },
      onError: () => toast.error(tCommon("genericError")),
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <form
        onSubmit={detailsForm.handleSubmit(onSubmitDetails)}
        className="rounded-xl bg-card ring-1 ring-foreground/10"
      >
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("detailsTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("detailsDescription")}</p>
        </div>
        <div className="p-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!detailsForm.formState.errors.name}>
                <FieldLabel htmlFor="profile-name">{t("nameLabel")}</FieldLabel>
                <Input id="profile-name" {...detailsForm.register("name")} />
                {detailsForm.formState.errors.name ? <FieldError>{tCommon("required")}</FieldError> : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-phone">{tFields("phone")}</FieldLabel>
                <Input id="profile-phone" {...detailsForm.register("phone")} />
              </Field>
            </div>
          </FieldGroup>
        </div>
        <div className="flex justify-end border-t px-4 py-3">
          <Button type="submit" disabled={updateDetails.isPending}>
            {updateDetails.isPending ? <Loader2Icon className="animate-spin" /> : null}
            {tCommon("save")}
          </Button>
        </div>
      </form>

      <form
        onSubmit={emailForm.handleSubmit(onSubmitEmail)}
        className="rounded-xl bg-card ring-1 ring-foreground/10"
      >
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("emailTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("emailDescription")}</p>
        </div>
        <div className="p-4">
          <Field data-invalid={!!emailForm.formState.errors.email}>
            <FieldLabel htmlFor="profile-email">{tFields("email")}</FieldLabel>
            <Input id="profile-email" type="email" {...emailForm.register("email")} />
            {emailForm.formState.errors.email ? <FieldError>{t("invalidEmail")}</FieldError> : null}
          </Field>
        </div>
        <div className="flex justify-end border-t px-4 py-3">
          <Button type="submit" variant="outline" disabled={updateEmail.isPending}>
            {updateEmail.isPending ? <Loader2Icon className="animate-spin" /> : null}
            {t("changeEmail")}
          </Button>
        </div>
      </form>

      <form
        onSubmit={passwordForm.handleSubmit(onSubmitPassword)}
        className="rounded-xl bg-card ring-1 ring-foreground/10"
      >
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("passwordTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("passwordDescription")}</p>
        </div>
        <div className="p-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!passwordForm.formState.errors.password}>
                <FieldLabel htmlFor="profile-new-password">{t("newPasswordLabel")}</FieldLabel>
                <Input
                  id="profile-new-password"
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register("password")}
                />
                {passwordForm.formState.errors.password ? (
                  <FieldError>{t("passwordTooShort")}</FieldError>
                ) : null}
              </Field>
              <Field data-invalid={!!passwordForm.formState.errors.confirmPassword}>
                <FieldLabel htmlFor="profile-confirm-password">{t("confirmPasswordLabel")}</FieldLabel>
                <Input
                  id="profile-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  {...passwordForm.register("confirmPassword")}
                />
                {passwordForm.formState.errors.confirmPassword ? (
                  <FieldError>{t("passwordsDontMatch")}</FieldError>
                ) : null}
              </Field>
            </div>
          </FieldGroup>
        </div>
        <div className="flex justify-end border-t px-4 py-3">
          <Button type="submit" variant="outline" disabled={updatePassword.isPending}>
            {updatePassword.isPending ? <Loader2Icon className="animate-spin" /> : null}
            {t("changePassword")}
          </Button>
        </div>
      </form>
    </div>
  )
}
