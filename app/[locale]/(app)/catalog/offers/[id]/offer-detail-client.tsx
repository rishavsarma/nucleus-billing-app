"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeftIcon, TrashIcon } from "lucide-react"

import { Link, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { OfferForm, formValuesToOfferInput, offerToFormValues, type OfferFormValues } from "@/components/offer-form"
import { OfferItemPicker } from "@/components/offer-item-picker"
import { useDeleteOffer, useOffer, useUpdateOffer } from "@/hooks/use-offers"
import { routes } from "@/lib/routes"

export function OfferDetailClient({ id }: { id: string }) {
  const t = useTranslations("Offers")
  const tCommon = useTranslations("Common")
  const router = useRouter()

  const { data: offer, isLoading } = useOffer(id)
  const updateOffer = useUpdateOffer()
  const deleteOffer = useDeleteOffer()
  const [confirmDelete, setConfirmDelete] = useState(false)

  function onSubmit(values: OfferFormValues) {
    updateOffer.mutate(
      { id, input: formValuesToOfferInput(values) },
      {
        onSuccess: () => toast.success(tCommon("updatedSuccess")),
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{tCommon("loading")}</div>
  }

  if (!offer) {
    return (
      <div className="flex flex-col gap-2">
        <Link href={routes.catalog.offers.list} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-3.5" />
          {t("backToList")}
        </Link>
        <p className="text-sm text-muted-foreground">{t("noResults")}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-2 flex items-center justify-between">
        <Link href={routes.catalog.offers.list} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-3.5" />
          {t("backToList")}
        </Link>
        <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
          <TrashIcon />
          {tCommon("delete")}
        </Button>
      </div>
      <h1 className="mb-4 text-2xl font-semibold">{offer.name}</h1>

      <OfferForm
        defaultValues={offerToFormValues(offer)}
        onSubmit={onSubmit}
        isSubmitting={updateOffer.isPending}
        submitLabel={tCommon("save")}
        itemPicker={
          <Field>
            <FieldLabel>{t("itemsScopeLabel")}</FieldLabel>
            <OfferItemPicker offerId={id} />
          </Field>
        }
      />

      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        isDeleting={deleteOffer.isPending}
        description={t("deleteDescription")}
        onConfirm={() =>
          deleteOffer.mutate(id, {
            onSuccess: () => {
              toast.success(tCommon("deletedSuccess"))
              router.push(routes.catalog.offers.list)
            },
            onError: () => toast.error(tCommon("genericError")),
          })
        }
      />
    </div>
  )
}
