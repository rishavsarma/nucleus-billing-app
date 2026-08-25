"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { z } from "zod"

import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useOrganizations, useUpdateOrganization } from "@/hooks/use-organizations"
import type { Organization } from "@/lib/database/types"

const organizationSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  billing_email: z.string().email().optional().or(z.literal("")),
  default_currency: z.string().min(1),
  gstin: z.string().optional(),
  state_code: z.string().optional(),
  gst_registered: z.boolean(),
  invoice_prefix: z.string().min(1),
  bill_prefix: z.string().min(1),
  credit_note_prefix: z.string().min(1),
  debit_note_prefix: z.string().min(1),
  pdf_watermark_text: z.string().optional(),
  pdf_logo_url: z.string().optional(),
  pdf_footer_notes: z.string().optional(),
  financial_year_start_month: z.number().min(1).max(12),
  low_stock_alerts_enabled: z.boolean(),
})
type OrganizationFormValues = z.infer<typeof organizationSchema>

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const SUBSCRIPTION_STATUS_LABEL_KEY = {
  trialing: "statusTrialing",
  active: "statusActive",
  past_due: "statusPastDue",
  cancelled: "statusCancelled",
} as const

export default function OrganizationPage() {
  const t = useTranslations("SettingsOrganization")
  const { data: organizations, isLoading } = useOrganizations()
  const organization = organizations?.[0]

  if (isLoading || !organization) {
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

  // Keyed by id so a fresh form (with correct defaultValues) mounts if the
  // underlying organization row ever changes, instead of trying to reconcile
  // in place — a Select-only field driven purely by setValue (no register())
  // doesn't participate in react-hook-form's reactive `values` resync, so
  // that option isn't safe to use here.
  return <OrganizationForm key={organization.id} organization={organization} />
}

function OrganizationForm({ organization }: { organization: Organization }) {
  const t = useTranslations("SettingsOrganization")
  const tSubscription = useTranslations("Subscription")
  const tCommon = useTranslations("Common")
  const updateOrganization = useUpdateOrganization()

  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: organization.name,
      slug: organization.slug ?? "",
      billing_email: organization.billing_email ?? "",
      default_currency: organization.default_currency,
      gstin: organization.gstin ?? "",
      state_code: organization.state_code ?? "",
      gst_registered: organization.gst_registered,
      invoice_prefix: organization.invoice_prefix,
      bill_prefix: organization.bill_prefix,
      credit_note_prefix: organization.credit_note_prefix,
      debit_note_prefix: organization.debit_note_prefix,
      pdf_watermark_text: organization.pdf_watermark_text ?? "",
      pdf_logo_url: organization.pdf_logo_url ?? "",
      pdf_footer_notes: organization.pdf_footer_notes ?? "",
      financial_year_start_month: organization.financial_year_start_month,
      low_stock_alerts_enabled: organization.low_stock_alerts_enabled,
    },
  })
  const { register, handleSubmit, formState, setValue, control } = form
  const gstRegistered = useWatch({ control, name: "gst_registered" })
  const lowStockAlertsEnabled = useWatch({ control, name: "low_stock_alerts_enabled" })
  const financialYearStartMonth = useWatch({ control, name: "financial_year_start_month" })

  function onSubmit(values: OrganizationFormValues) {
    updateOrganization.mutate(
      {
        id: organization.id,
        input: {
          ...values,
          slug: values.slug || null,
          billing_email: values.billing_email || null,
          gstin: values.gstin || null,
          state_code: values.state_code || null,
          pdf_watermark_text: values.pdf_watermark_text || null,
          pdf_logo_url: values.pdf_logo_url || null,
          pdf_footer_notes: values.pdf_footer_notes || null,
        },
      },
      {
        onSuccess: () => toast.success(tCommon("updatedSuccess")),
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button type="submit" disabled={updateOrganization.isPending}>
          {updateOrganization.isPending ? <Loader2Icon className="animate-spin" /> : null}
          {t("saveChanges")}
        </Button>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("generalTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("generalDescription")}</p>
        </div>
        <div className="p-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!formState.errors.name}>
                <FieldLabel htmlFor="org-name">{t("nameLabel")}</FieldLabel>
                <Input id="org-name" {...register("name")} aria-invalid={!!formState.errors.name} />
              </Field>
              <Field>
                <FieldLabel htmlFor="org-slug">{t("slugLabel")}</FieldLabel>
                <Input id="org-slug" {...register("slug")} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="org-billing-email">{t("billingEmailLabel")}</FieldLabel>
                <Input id="org-billing-email" type="email" {...register("billing_email")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="org-currency">{t("currencyLabel")}</FieldLabel>
                <Input id="org-currency" {...register("default_currency")} />
              </Field>
            </div>
          </FieldGroup>
        </div>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("gstTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("gstDescription")}</p>
        </div>
        <div className="p-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="org-gstin">{t("gstinLabel")}</FieldLabel>
                <Input id="org-gstin" {...register("gstin")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="org-state-code">{t("stateCodeLabel")}</FieldLabel>
                <Input id="org-state-code" {...register("state_code")} />
              </Field>
            </div>
            <Field orientation="horizontal">
              <div>
                <FieldLabel htmlFor="org-gst-registered">{t("gstRegisteredLabel")}</FieldLabel>
                <p className="text-xs text-muted-foreground">{t("gstRegisteredHint")}</p>
              </div>
              <Switch
                id="org-gst-registered"
                className="ml-auto"
                checked={gstRegistered}
                onCheckedChange={(checked) => setValue("gst_registered", checked)}
              />
            </Field>
          </FieldGroup>
        </div>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("numberingTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("numberingDescription")}</p>
        </div>
        <div className="p-4">
          <FieldGroup>
            <div className="grid grid-cols-4 gap-4">
              <Field>
                <FieldLabel htmlFor="org-invoice-prefix">{t("invoicePrefixLabel")}</FieldLabel>
                <Input id="org-invoice-prefix" {...register("invoice_prefix")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="org-bill-prefix">{t("billPrefixLabel")}</FieldLabel>
                <Input id="org-bill-prefix" {...register("bill_prefix")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="org-credit-note-prefix">{t("creditNotePrefixLabel")}</FieldLabel>
                <Input id="org-credit-note-prefix" {...register("credit_note_prefix")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="org-debit-note-prefix">{t("debitNotePrefixLabel")}</FieldLabel>
                <Input id="org-debit-note-prefix" {...register("debit_note_prefix")} />
              </Field>
            </div>
          </FieldGroup>
        </div>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("pdfTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("pdfDescription")}</p>
        </div>
        <div className="p-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="org-watermark">{t("watermarkLabel")}</FieldLabel>
              <Input id="org-watermark" {...register("pdf_watermark_text")} />
              <p className="text-xs text-muted-foreground">{t("watermarkHint")}</p>
            </Field>
            <Field>
              <FieldLabel htmlFor="org-logo-url">{t("logoUrlLabel")}</FieldLabel>
              <Input id="org-logo-url" {...register("pdf_logo_url")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="org-footer-notes">{t("footerNotesLabel")}</FieldLabel>
              <Input id="org-footer-notes" {...register("pdf_footer_notes")} />
            </Field>
          </FieldGroup>
        </div>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("preferencesTitle")}</h2>
        </div>
        <div className="p-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="org-fy-start">{t("financialYearLabel")}</FieldLabel>
              <Select
                value={String(financialYearStartMonth)}
                onValueChange={(value) => setValue("financial_year_start_month", Number(value))}
              >
                <SelectTrigger id="org-fy-start" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, index) => (
                    <SelectItem key={month} value={String(index + 1)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field orientation="horizontal">
              <div>
                <FieldLabel htmlFor="org-low-stock-alerts">{t("lowStockAlertsLabel")}</FieldLabel>
                <p className="text-xs text-muted-foreground">{t("lowStockAlertsHint")}</p>
              </div>
              <Switch
                id="org-low-stock-alerts"
                className="ml-auto"
                checked={lowStockAlertsEnabled}
                onCheckedChange={(checked) => setValue("low_stock_alerts_enabled", checked)}
              />
            </Field>
          </FieldGroup>
        </div>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("accountStatusTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("accountStatusDescription")}</p>
        </div>
        <div className="flex items-center gap-8 p-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t("activeLabel")}</span>
            <StatusBadge status={organization.is_active ? "active" : "inactive"}>
              {organization.is_active ? tCommon("yes") : tCommon("no")}
            </StatusBadge>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t("subscriptionStatusLabel")}</span>
            <StatusBadge status={organization.subscription_status}>
              {tSubscription(SUBSCRIPTION_STATUS_LABEL_KEY[organization.subscription_status])}
            </StatusBadge>
          </div>
        </div>
      </div>
    </form>
  )
}
