"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeftIcon, TrashIcon } from "lucide-react"

import { Link, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { PartyForm, formValuesToPartyInput, partyToFormValues, type PartyFormValues } from "@/components/party-form"
import { useCustomers, useDeleteCustomer, useUpdateCustomer } from "@/hooks/use-customers"
import { routes } from "@/lib/routes"

export function CustomerDetailClient({ id }: { id: string }) {
  const t = useTranslations("Customers")
  const tFields = useTranslations("PartyFields")
  const tCommon = useTranslations("Common")
  const router = useRouter()

  const { data: customers, isLoading } = useCustomers()
  const updateCustomer = useUpdateCustomer()
  const deleteCustomer = useDeleteCustomer()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const customer = customers?.find((c) => c.id === id)

  function onSubmit(values: PartyFormValues) {
    updateCustomer.mutate(
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

  if (!customer) {
    return (
      <div className="flex flex-col gap-2">
        <Link href={routes.parties.customers.list} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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
        <Link href={routes.parties.customers.list} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-3.5" />
          {t("backToList")}
        </Link>
        <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
          <TrashIcon />
          {tCommon("delete")}
        </Button>
      </div>
      <h1 className="mb-4 text-2xl font-semibold">{customer.name}</h1>

      <PartyForm
        defaultValues={partyToFormValues(customer)}
        onSubmit={onSubmit}
        isSubmitting={updateCustomer.isPending}
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
        isDeleting={deleteCustomer.isPending}
        description={t("deleteDescription")}
        onConfirm={() =>
          deleteCustomer.mutate(id, {
            onSuccess: () => {
              toast.success(tCommon("deletedSuccess"))
              router.push(routes.parties.customers.list)
            },
            onError: () => toast.error(tCommon("genericError")),
          })
        }
      />
    </div>
  )
}
