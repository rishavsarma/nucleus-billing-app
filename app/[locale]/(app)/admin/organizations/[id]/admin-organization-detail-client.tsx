"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon, Loader2Icon, PlusIcon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { z } from "zod"

import { Link } from "@/i18n/navigation"
import { routes } from "@/lib/routes"
import { AddOrgUserDialog } from "@/components/add-org-user-dialog"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useOrganization, useUpdateOrganization } from "@/hooks/use-organizations"
import type { Organization } from "@/lib/database/types"

const adminOrganizationSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  billing_email: z.string().email().optional().or(z.literal("")),
  default_currency: z.string().min(1),
  is_active: z.boolean(),
  subscription_status: z.enum(["trialing", "active", "past_due", "cancelled"]),
  subscription_current_period_end: z.string().optional(),
})
type AdminOrganizationFormValues = z.infer<typeof adminOrganizationSchema>

const STATUS_OPTIONS = ["trialing", "active", "past_due", "cancelled"] as const
const STATUS_LABEL_KEY = {
  trialing: "statusTrialing",
  active: "statusActive",
  past_due: "statusPastDue",
  cancelled: "statusCancelled",
} as const

export function AdminOrganizationDetailClient({ id }: { id: string }) {
  const t = useTranslations("AdminOrganizations")
  const tCommon = useTranslations("Common")
  const { data: organization, isLoading } = useOrganization(id)

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{tCommon("loading")}</div>
  }

  if (!organization) {
    return (
      <div className="flex flex-col gap-2">
        <Link
          href={routes.admin.organizations.list}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("backToList")}
        </Link>
        <p className="text-sm text-muted-foreground">{t("noResults")}</p>
      </div>
    )
  }

  return <AdminOrganizationForm key={organization.id} organization={organization} />
}

function AdminOrganizationForm({ organization }: { organization: Organization }) {
  const t = useTranslations("AdminOrganizations")
  const tCommon = useTranslations("Common")
  const updateOrganization = useUpdateOrganization()

  const form = useForm<AdminOrganizationFormValues>({
    resolver: zodResolver(adminOrganizationSchema),
    defaultValues: {
      name: organization.name,
      slug: organization.slug ?? "",
      billing_email: organization.billing_email ?? "",
      default_currency: organization.default_currency,
      is_active: organization.is_active,
      subscription_status: organization.subscription_status,
      subscription_current_period_end: organization.subscription_current_period_end?.slice(0, 10) ?? "",
    },
  })
  const { register, handleSubmit, formState, setValue, control } = form
  const isActive = useWatch({ control, name: "is_active" })
  const subscriptionStatus = useWatch({ control, name: "subscription_status" })
  const subscriptionCurrentPeriodEnd = useWatch({ control, name: "subscription_current_period_end" })
  const [addUserOpen, setAddUserOpen] = useState(false)

  function onSubmit(values: AdminOrganizationFormValues) {
    updateOrganization.mutate(
      {
        id: organization.id,
        input: {
          name: values.name,
          slug: values.slug || null,
          billing_email: values.billing_email || null,
          default_currency: values.default_currency,
          is_active: values.is_active,
          subscription_status: values.subscription_status,
          subscription_current_period_end: values.subscription_current_period_end || null,
        },
      },
      {
        onSuccess: () => toast.success(tCommon("updatedSuccess")),
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-2 flex items-center justify-between">
        <Link
          href={routes.admin.organizations.list}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("backToList")}
        </Link>
      </div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{organization.name}</h1>
        <StatusBadge status={organization.is_active ? "active" : "inactive"}>
          {organization.is_active ? tCommon("yes") : tCommon("no")}
        </StatusBadge>
        <StatusBadge status={organization.subscription_status}>
          {t(STATUS_LABEL_KEY[organization.subscription_status])}
        </StatusBadge>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">{t("basicDetailsTitle")}</h2>
            <p className="text-xs text-muted-foreground">{t("basicDetailsDescription")}</p>
          </div>
          <div className="p-4">
            <FieldGroup>
              <div className="grid grid-cols-2 gap-4">
                <Field data-invalid={!!formState.errors.name}>
                  <FieldLabel htmlFor="admin-org-name">{t("nameLabel")}</FieldLabel>
                  <Input id="admin-org-name" {...register("name")} aria-invalid={!!formState.errors.name} />
                  {formState.errors.name ? <FieldError>{tCommon("required")}</FieldError> : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="admin-org-slug">{t("slugLabel")}</FieldLabel>
                  <Input id="admin-org-slug" {...register("slug")} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="admin-org-billing-email">{t("billingEmailLabel")}</FieldLabel>
                  <Input id="admin-org-billing-email" type="email" {...register("billing_email")} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="admin-org-currency">{t("currencyLabel")}</FieldLabel>
                  <Input id="admin-org-currency" {...register("default_currency")} />
                </Field>
              </div>
            </FieldGroup>
          </div>
        </div>

        <div className="rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">{t("statusTitle")}</h2>
            <p className="text-xs text-muted-foreground">{t("statusDescription")}</p>
          </div>
          <div className="p-4">
            <FieldGroup>
              <Field orientation="horizontal">
                <div>
                  <FieldLabel htmlFor="admin-org-active">{t("activeLabel")}</FieldLabel>
                  <p className="text-xs text-muted-foreground">{t("activeHint")}</p>
                </div>
                <Switch
                  id="admin-org-active"
                  className="ml-auto"
                  checked={isActive}
                  onCheckedChange={(checked) => setValue("is_active", checked)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="admin-org-subscription-status">{t("subscriptionStatusLabel")}</FieldLabel>
                  <Select
                    value={subscriptionStatus}
                    onValueChange={(value) =>
                      setValue("subscription_status", value as AdminOrganizationFormValues["subscription_status"])
                    }
                  >
                    <SelectTrigger id="admin-org-subscription-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {t(STATUS_LABEL_KEY[status])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="admin-org-period-end">{t("subscriptionPeriodEndLabel")}</FieldLabel>
                  <DatePicker
                    id="admin-org-period-end"
                    value={subscriptionCurrentPeriodEnd}
                    onChange={(value) =>
                      setValue("subscription_current_period_end", value, { shouldValidate: true })
                    }
                    clearable
                  />
                </Field>
              </div>
            </FieldGroup>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={updateOrganization.isPending}>
            {updateOrganization.isPending ? <Loader2Icon className="animate-spin" /> : null}
            {t("saveChanges")}
          </Button>
        </div>
      </form>

      <div className="mt-6 rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">{t("teamTitle")}</h2>
            <p className="text-xs text-muted-foreground">{t("teamDescription")}</p>
          </div>
          <Button size="sm" onClick={() => setAddUserOpen(true)}>
            <PlusIcon />
            {t("addUser")}
          </Button>
        </div>
      </div>

      <AddOrgUserDialog orgId={organization.id} open={addUserOpen} onOpenChange={setAddUserOpen} />
    </div>
  )
}
