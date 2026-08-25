"use client"

import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeftIcon } from "lucide-react"

import { Link, useRouter } from "@/i18n/navigation"
import { PartyForm, formValuesToPartyInput, type PartyFormValues } from "@/components/party-form"
import { useCreateCustomer } from "@/hooks/use-customers"

export default function NewCustomerPage() {
  const t = useTranslations("Customers")
  const tFields = useTranslations("PartyFields")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const createCustomer = useCreateCustomer()

  function onSubmit(values: PartyFormValues) {
    createCustomer.mutate(formValuesToPartyInput(values), {
      onSuccess: (customer) => {
        toast.success(tCommon("createdSuccess"))
        router.push(`/parties/customers/${customer.id}`)
      },
      onError: () => toast.error(tCommon("genericError")),
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Link href="/parties/customers" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" />
        {t("backToList")}
      </Link>
      <h1 className="mb-4 text-2xl font-semibold">{t("newCustomer")}</h1>

      <PartyForm
        onSubmit={onSubmit}
        isSubmitting={createCustomer.isPending}
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
