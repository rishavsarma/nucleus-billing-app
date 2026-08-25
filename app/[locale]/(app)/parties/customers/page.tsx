"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { routes } from "@/lib/routes"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useCustomers, useDeleteCustomer } from "@/hooks/use-customers"
import type { Customer } from "@/lib/database/types"

const columnHelper = entityColumnHelper<Customer>()

export default function CustomersPage() {
  const t = useTranslations("Customers")
  const tCommon = useTranslations("Common")
  const { data: customers, isLoading } = useCustomers()
  const deleteCustomer = useDeleteCustomer()
  const [toDelete, setToDelete] = useState<Customer | null>(null)

  const columns = [
    columnHelper.accessor("name", {
      header: t("columnName"),
      cell: ({ getValue, row }) => (
        <Link href={routes.parties.customers.detail(row.original.id)} className="font-medium hover:underline">
          {getValue()}
        </Link>
      ),
    }),
    columnHelper.display({
      id: "contact",
      header: t("columnContact"),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span>{row.original.email ?? "—"}</span>
          <span className="text-xs text-muted-foreground">{row.original.phone ?? ""}</span>
        </div>
      ),
    }),
    columnHelper.display({
      id: "location",
      header: t("columnLocation"),
      cell: ({ row }) => {
        const address = (row.original.billing_address ?? {}) as { city?: string; state?: string }
        return <span>{[address.city, address.state].filter(Boolean).join(", ") || "—"}</span>
      },
    }),
    columnHelper.accessor("tax_id", {
      header: t("columnGstin"),
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() ?? "—"}</span>,
    }),
    columnHelper.display({
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={routes.parties.customers.detail(row.original.id)} onClick={(event) => event.stopPropagation()}>
              <PencilIcon />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(event) => {
              event.stopPropagation()
              setToDelete(row.original)
            }}
          >
            <TrashIcon />
          </Button>
        </div>
      ),
    }),
  ]

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button asChild>
          <Link href={routes.parties.customers.new}>
            <PlusIcon />
            {t("newCustomer")}
          </Link>
        </Button>
      </div>

      <EntityTable
        columns={columns}
        data={customers ?? []}
        isLoading={isLoading}
        searchPlaceholder={t("searchPlaceholder")}
        matchesSearch={(row, query) =>
          row.name.toLowerCase().includes(query) ||
          (row.email?.toLowerCase().includes(query) ?? false) ||
          (row.phone?.toLowerCase().includes(query) ?? false)
        }
        emptyMessage={t("noResults")}
      />

      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        isDeleting={deleteCustomer.isPending}
        description={t("deleteDescription")}
        onConfirm={() => {
          if (!toDelete) return
          deleteCustomer.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success(tCommon("deletedSuccess"))
              setToDelete(null)
            },
            onError: () => toast.error(tCommon("genericError")),
          })
        }}
      />
    </div>
  )
}
