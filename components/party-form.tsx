"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslations } from "next-intl"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { Customer, Vendor } from "@/lib/database/types"

export const partyFormSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  tax_id: z.string().optional(),
  address_line: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
})

export type PartyFormValues = z.infer<typeof partyFormSchema>

type BillingAddress = {
  line1?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

/** Flattens the party's jsonb `billing_address` into the form's field shape. */
export function partyToFormValues(party?: Customer | Vendor): Partial<PartyFormValues> {
  const address = (party?.billing_address ?? {}) as BillingAddress
  return {
    name: party?.name ?? "",
    email: party?.email ?? "",
    phone: party?.phone ?? "",
    tax_id: party?.tax_id ?? "",
    address_line: address.line1 ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    postal_code: address.postal_code ?? "",
    country: address.country ?? "",
    notes: party?.notes ?? "",
  }
}

/** Reassembles the form's flat address fields back into `billing_address` jsonb. */
export function formValuesToPartyInput(values: PartyFormValues) {
  return {
    name: values.name,
    email: values.email || null,
    phone: values.phone || null,
    tax_id: values.tax_id || null,
    notes: values.notes || null,
    billing_address: {
      line1: values.address_line || null,
      city: values.city || null,
      state: values.state || null,
      postal_code: values.postal_code || null,
      country: values.country || null,
    },
  }
}

/** Shared create/edit form for customers and vendors — identical field shape,
 * only the copy differs (supplied by the caller so it stays i18n-driven). */
export function PartyForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  nameLabel,
  basicDetailsTitle,
  basicDetailsDescription,
  addressTitle,
  addressDescription,
  submitLabel,
}: {
  defaultValues?: Partial<PartyFormValues>
  onSubmit: (values: PartyFormValues) => void
  isSubmitting?: boolean
  nameLabel: string
  basicDetailsTitle: string
  basicDetailsDescription: string
  addressTitle: string
  addressDescription: string
  submitLabel: string
}) {
  const t = useTranslations("PartyFields")
  const tCommon = useTranslations("Common")
  const form = useForm<PartyFormValues>({
    resolver: zodResolver(partyFormSchema),
    defaultValues: { name: "", email: "", phone: "", tax_id: "", address_line: "", city: "", state: "", postal_code: "", country: "", notes: "", ...defaultValues },
  })

  const { register, handleSubmit, formState } = form

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{basicDetailsTitle}</h2>
          <p className="text-xs text-muted-foreground">{basicDetailsDescription}</p>
        </div>
        <div className="p-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!formState.errors.name}>
                <FieldLabel htmlFor="name">{nameLabel}</FieldLabel>
                <Input id="name" {...register("name")} aria-invalid={!!formState.errors.name} />
                {formState.errors.name ? <FieldError>{tCommon("required")}</FieldError> : null}
              </Field>
              <Field>
                <FieldLabel htmlFor="email">{t("email")}</FieldLabel>
                <Input id="email" type="email" {...register("email")} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="phone">{t("phone")}</FieldLabel>
                <Input id="phone" {...register("phone")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="tax_id">{t("taxId")}</FieldLabel>
                <Input id="tax_id" {...register("tax_id")} />
              </Field>
            </div>
          </FieldGroup>
        </div>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{addressTitle}</h2>
          <p className="text-xs text-muted-foreground">{addressDescription}</p>
        </div>
        <div className="p-4">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="address_line">{t("addressLine")}</FieldLabel>
                <Input id="address_line" {...register("address_line")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="city">{t("city")}</FieldLabel>
                <Input id="city" {...register("city")} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Field>
                <FieldLabel htmlFor="state">{t("state")}</FieldLabel>
                <Input id="state" {...register("state")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="postal_code">{t("postalCode")}</FieldLabel>
                <Input id="postal_code" {...register("postal_code")} />
              </Field>
              <Field>
                <FieldLabel htmlFor="country">{t("country")}</FieldLabel>
                <Input id="country" {...register("country")} />
              </Field>
            </div>
          </FieldGroup>
        </div>
      </div>

      <div className="rounded-xl bg-card ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{t("notesTitle")}</h2>
        </div>
        <div className="p-4">
          <Field>
            <Textarea {...register("notes")} placeholder={t("notesPlaceholder")} />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
