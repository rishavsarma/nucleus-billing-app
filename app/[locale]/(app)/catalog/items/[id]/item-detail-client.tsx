"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeftIcon, TrashIcon } from "lucide-react"

import { Link, useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { ItemForm, formValuesToItemInput, itemToFormValues, type ItemFormValues } from "@/components/item-form"
import { useDeleteItem, useItems, useUpdateItem } from "@/hooks/use-items"
import { routes } from "@/lib/routes"

export function ItemDetailClient({ id }: { id: string }) {
  const t = useTranslations("Items")
  const tCommon = useTranslations("Common")
  const router = useRouter()

  const { data: items, isLoading } = useItems()
  const updateItem = useUpdateItem()
  const deleteItem = useDeleteItem()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const item = items?.find((i) => i.id === id)

  function onSubmit(values: ItemFormValues) {
    updateItem.mutate(
      { id, input: formValuesToItemInput(values) },
      {
        onSuccess: () => toast.success(tCommon("updatedSuccess")),
        onError: () => toast.error(tCommon("genericError")),
      },
    )
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{tCommon("loading")}</div>
  }

  if (!item) {
    return (
      <div className="flex flex-col gap-2">
        <Link href={routes.catalog.items.list} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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
        <Link href={routes.catalog.items.list} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="size-3.5" />
          {t("backToList")}
        </Link>
        <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
          <TrashIcon />
          {tCommon("delete")}
        </Button>
      </div>
      <h1 className="mb-4 text-2xl font-semibold">{item.name}</h1>

      <ItemForm
        defaultValues={itemToFormValues(item)}
        onSubmit={onSubmit}
        isSubmitting={updateItem.isPending}
        submitLabel={tCommon("save")}
      />

      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        isDeleting={deleteItem.isPending}
        description={t("deleteDescription")}
        onConfirm={() =>
          deleteItem.mutate(id, {
            onSuccess: () => {
              toast.success(tCommon("deletedSuccess"))
              router.push(routes.catalog.items.list)
            },
            onError: () => toast.error(tCommon("genericError")),
          })
        }
      />
    </div>
  )
}
