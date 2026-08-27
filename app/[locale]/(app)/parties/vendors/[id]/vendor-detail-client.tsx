"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeftIcon, TrashIcon } from "lucide-react"

import { Link, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { PartyForm, formValuesToPartyInput, partyToFormValues, type PartyFormValues } from "@/components/party-form"
import { useVendor, useDeleteVendor, useUpdateVendor } from "@/hooks/use-vendors"
import { routes } from "@/lib/routes"

export function VendorDetailClient({ id }: { id: string }) {
  const t = useTranslations("Vendors")
  const tFields = useTranslations("PartyFields")
  const tCommon = useTranslations("Common")
  const router = useRouter()

  const { data: vendor, isLoading } = useVendor(id)
  const updateVendor = useUpdateVendor()
  const deleteVendor = useDeleteVendor()
  const [confirmDelete, setConfirmDelete] = useState(false)

  function onSubmit(values: PartyFormValues) {
    updateVendor.mutate(
      { id, input: formValuesToPartyInput(values) },
      {
        onSuccess: () => toast.success(tCommon("updatedSuccess")),
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{tCommon("loading")}</div>
  }

  if (!vendor) {
    return (
      <div className="flex flex-col gap-2">
        <Link href={routes.parties.vendors.list} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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
        <Link href={routes.parties.vendors.list} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-3.5" />
          {t("backToList")}
        </Link>
        <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
          <TrashIcon />
          {tCommon("delete")}
        </Button>
      </div>
      <h1 className="mb-4 text-2xl font-semibold">{vendor.name}</h1>

      <PartyForm
        defaultValues={partyToFormValues(vendor)}
        onSubmit={onSubmit}
        isSubmitting={updateVendor.isPending}
        nameLabel={t("nameLabel")}
        basicDetailsTitle={tFields("basicDetailsTitle")}
        basicDetailsDescription={t("basicDetailsDescription")}
        addressTitle={tFields("addressTitle")}
        addressDescription={t("addressDescription")}
        submitLabel={tCommon("save")}
      />

      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        isDeleting={deleteVendor.isPending}
        description={t("deleteDescription")}
        onConfirm={() =>
          deleteVendor.mutate(id, {
            onSuccess: () => {
              toast.success(tCommon("deletedSuccess"))
              router.push(routes.parties.vendors.list)
            },
            onError: () => toast.error(tCommon("genericError")),
          })
        }
      />
    </div>
  )
}
