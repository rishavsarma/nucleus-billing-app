"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2Icon, ArrowLeftIcon } from "lucide-react"
import { useForm } from "react-hook-form"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { z } from "zod"

import { Link, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useCreateOrganization } from "@/hooks/use-organizations"
import { routes } from "@/lib/routes"

const newOrganizationSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  billing_email: z.string().email().optional().or(z.literal("")),
  default_currency: z.string().min(1),
})
type NewOrganizationFormValues = z.infer<typeof newOrganizationSchema>

export default function NewOrganizationPage() {
  const t = useTranslations("AdminOrganizations")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const createOrganization = useCreateOrganization()

  const { register, handleSubmit, formState } = useForm<NewOrganizationFormValues>({
    resolver: zodResolver(newOrganizationSchema),
    defaultValues: { name: "", slug: "", billing_email: "", default_currency: "INR" },
  })

  function onSubmit(values: NewOrganizationFormValues) {
    createOrganization.mutate(
      {
        name: values.name,
        slug: values.slug || null,
        billing_email: values.billing_email || null,
        default_currency: values.default_currency,
      },
      {
        onSuccess: (organization) => {
          toast.success(tCommon("createdSuccess"))
          router.push(routes.admin.organizations.detail(organization.id))
        },
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Link
        href={routes.admin.organizations.list}
        className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        {t("backToList")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("newOrganization")}</h1>
      <p className="mb-4 text-sm text-muted-foreground">{t("createDescription")}</p>

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
                  <FieldLabel htmlFor="new-org-name">{t("nameLabel")}</FieldLabel>
                  <Input id="new-org-name" {...register("name")} aria-invalid={!!formState.errors.name} />
                  {formState.errors.name ? <FieldError>{tCommon("required")}</FieldError> : null}
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-org-slug">{t("slugLabel")}</FieldLabel>
                  <Input id="new-org-slug" {...register("slug")} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="new-org-billing-email">{t("billingEmailLabel")}</FieldLabel>
                  <Input id="new-org-billing-email" type="email" {...register("billing_email")} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-org-currency">{t("currencyLabel")}</FieldLabel>
                  <Input id="new-org-currency" {...register("default_currency")} />
                </Field>
              </div>
            </FieldGroup>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={createOrganization.isPending}>
            {createOrganization.isPending ? <Loader2Icon className="animate-spin" /> : null}
            {tCommon("create")}
          </Button>
        </div>
      </form>
    </div>
  )
}
