"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { PencilIcon, PlusIcon, TrashIcon } from "lucide-react"

import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useServerTableParams } from "@/components/server-table"
import { StatusBadge } from "@/components/status-badge"
import { useDeleteOffer, useOffersList } from "@/hooks/use-offers"
import { routes } from "@/lib/routes"
import type { Offer } from "@/lib/database/types"

const columnHelper = entityColumnHelper<Offer>()
const money = (n: number) => "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function offerStatus(offer: Offer): "active" | "expired" | "upcoming" | "inactive" {
  if (!offer.is_active) return "inactive"
  const today = new Date().toISOString().slice(0, 10)
  if (offer.ends_at && offer.ends_at < today) return "expired"
  if (offer.starts_at && offer.starts_at > today) return "upcoming"
  return "active"
}

export default function OffersPage() {
  const t = useTranslations("Offers")
  const tCommon = useTranslations("Common")
  const { params, tableControlProps } = useServerTableParams()
  const { data: result, isLoading } = useOffersList(params)
  const deleteOffer = useDeleteOffer()
  const [toDelete, setToDelete] = useState<Offer | null>(null)

  const statusLabel = {
    active: t("statusActive"),
    expired: t("statusExpired"),
    upcoming: t("statusUpcoming"),
    inactive: t("statusInactive"),
  }

  const columns = [
    columnHelper.accessor("name", {
      header: t("columnName"),
      cell: ({ getValue, row }) => (
        <Link href={routes.catalog.offers.detail(row.original.id)} className="font-medium hover:underline">
          {getValue()}
        </Link>
      ),
    }),
    columnHelper.display({
      id: "discount",
      header: t("columnDiscount"),
      cell: ({ row }) =>
        row.original.discount_type === "percentage" ? `${row.original.value}%` : money(row.original.value),
    }),
    columnHelper.accessor("applies_to_all_items", {
      header: t("columnAppliesTo"),
      cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() ? t("appliesToAllItems") : t("appliesToSelected")}</span>,
    }),
    columnHelper.display({
      id: "window",
      header: t("columnWindow"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.starts_at ?? "—"} – {row.original.ends_at ?? t("noWindow")}
        </span>
      ),
    }),
    columnHelper.display({
      id: "status",
      header: t("columnStatus"),
      cell: ({ row }) => {
        const status = offerStatus(row.original)
        return <StatusBadge status={status}>{statusLabel[status]}</StatusBadge>
      },
    }),
    columnHelper.display({
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={routes.catalog.offers.detail(row.original.id)} onClick={(event) => event.stopPropagation()}>
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
          <Link href={routes.catalog.offers.new}>
            <PlusIcon />
            {t("newOffer")}
          </Link>
        </Button>
      </div>

      <EntityTable
        columns={columns}
        data={result?.data ?? []}
        isLoading={isLoading}
        totalCount={result?.total ?? 0}
        {...tableControlProps}
        searchPlaceholder={t("searchPlaceholder")}
        emptyMessage={t("noResults")}
      />

      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        isDeleting={deleteOffer.isPending}
        description={t("deleteDescription")}
        onConfirm={() => {
          if (!toDelete) return
          deleteOffer.mutate(toDelete.id, {
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
