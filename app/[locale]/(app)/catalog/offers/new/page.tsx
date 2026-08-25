"use client"

import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeftIcon } from "lucide-react"

import { Link, useRouter } from "@/i18n/navigation"
import { OfferForm, formValuesToOfferInput, type OfferFormValues } from "@/components/offer-form"
import { useCreateOffer } from "@/hooks/use-offers"
import { routes } from "@/lib/routes"

export default function NewOfferPage() {
  const t = useTranslations("Offers")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const createOffer = useCreateOffer()

  function onSubmit(values: OfferFormValues) {
    createOffer.mutate(formValuesToOfferInput(values), {
      onSuccess: (offer) => {
        toast.success(tCommon("createdSuccess"))
        router.push(routes.catalog.offers.detail(offer.id))
      },
      onError: () => toast.error(tCommon("genericError")),
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Link href={routes.catalog.offers.list} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" />
        {t("backToList")}
      </Link>
      <h1 className="mb-4 text-2xl font-semibold">{t("newOffer")}</h1>

      <OfferForm
        onSubmit={onSubmit}
        isSubmitting={createOffer.isPending}
        submitLabel={tCommon("create")}
        itemPicker={<p className="text-xs text-muted-foreground">{t("saveFirstNote")}</p>}
      />
    </div>
  )
}
