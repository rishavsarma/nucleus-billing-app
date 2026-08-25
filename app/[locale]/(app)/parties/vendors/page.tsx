"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useVendors, useDeleteVendor } from "@/hooks/use-vendors"
import type { Vendor } from "@/lib/database/types"

const columnHelper = entityColumnHelper<Vendor>()

export default function VendorsPage() {
  const t = useTranslations("Vendors")
  const tCommon = useTranslations("Common")
  const { data: vendors, isLoading } = useVendors()
  const deleteVendor = useDeleteVendor()
  const [toDelete, setToDelete] = useState<Vendor | null>(null)

  const columns = [
    columnHelper.accessor("name", {
      header: t("columnName"),
      cell: ({ getValue, row }) => (
        <Link href={`/parties/vendors/${row.original.id}`} className="font-medium hover:underline">
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
            <Link href={`/parties/vendors/${row.original.id}`} onClick={(event) => event.stopPropagation()}>
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
          <Link href="/parties/vendors/new">
            <PlusIcon />
            {t("newVendor")}
          </Link>
        </Button>
      </div>

      <EntityTable
        columns={columns}
        data={vendors ?? []}
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
        isDeleting={deleteVendor.isPending}
        description={t("deleteDescription")}
        onConfirm={() => {
          if (!toDelete) return
          deleteVendor.mutate(toDelete.id, {
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
