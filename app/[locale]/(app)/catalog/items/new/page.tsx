"use client"

import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { ArrowLeftIcon } from "lucide-react"

import { Link, useRouter } from "@/i18n/navigation"
import { ItemForm, formValuesToItemInput, type ItemFormValues } from "@/components/item-form"
import { useCreateItem } from "@/hooks/use-items"
import { routes } from "@/lib/routes"

export default function NewItemPage() {
  const t = useTranslations("Items")
  const tCommon = useTranslations("Common")
  const router = useRouter()
  const createItem = useCreateItem()

  function onSubmit(values: ItemFormValues) {
    createItem.mutate(formValuesToItemInput(values), {
      onSuccess: (item) => {
        toast.success(tCommon("createdSuccess"))
        router.push(routes.catalog.items.detail(item.id))
      },
      onError: () => toast.error(tCommon("genericError")),
    })
  }

  return (
    <div className="flex flex-col gap-1">
      <Link href={routes.catalog.items.list} className="mb-2 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-3.5" />
        {t("backToList")}
      </Link>
      <h1 className="mb-4 text-2xl font-semibold">{t("newItem")}</h1>

      <ItemForm onSubmit={onSubmit} isSubmitting={createItem.isPending} submitLabel={tCommon("create")} />
    </div>
  )
}
