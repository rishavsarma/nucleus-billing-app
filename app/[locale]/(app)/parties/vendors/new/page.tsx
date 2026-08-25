"use client"

import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeftIcon } from "lucide-react"

import { Link, useRouter } from "@/i18n/navigation"
import { PartyForm, formValuesToPartyInput, type PartyFormValues } from "@/components/party-form"
import { useCreateVendor } from "@/hooks/use-vendors"
import { routes } from "@/lib/routes"

export default function NewVendorPage() {
  const t = useTranslations("Vendors")
  const tFields = useTranslations("PartyFields")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const createVendor = useCreateVendor()

  function onSubmit(values: PartyFormValues) {
    createVendor.mutate(formValuesToPartyInput(values), {
      onSuccess: (vendor) => {
        toast.success(tCommon("createdSuccess"))
        router.push(routes.parties.vendors.detail(vendor.id))
      },
      onError: () => toast.error(tCommon("genericError")),
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Link href={routes.parties.vendors.list} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" />
        {t("backToList")}
      </Link>
      <h1 className="mb-4 text-2xl font-semibold">{t("newVendor")}</h1>

      <PartyForm
        onSubmit={onSubmit}
        isSubmitting={createVendor.isPending}
        nameLabel={t("nameLabel")}
        basicDetailsTitle={tFields("basicDetailsTitle")}
        basicDetailsDescription={t("basicDetailsDescription")}
        addressTitle={tFields("addressTitle")}
        addressDescription={t("addressDescription")}
        submitLabel={tCommon("create")}
      />
    </div>
  )
}
