"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { PlusIcon, TrashIcon, UserIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDeleteMembership, useUpdateMembership } from "@/hooks/use-memberships"
import { useOrgMembers } from "@/hooks/use-org-members"
import type { OrgMember } from "@/lib/services/org-members"

const columnHelper = entityColumnHelper<OrgMember>()

const ROLE_LABEL_KEY = { owner: "owner", admin: "admin", member: "member" } as const

export default function MembersPage() {
  const t = useTranslations("SettingsMembers")
  const tRoles = useTranslations("Roles")
  const tCommon = useTranslations("Common")
  const { data: members, isLoading } = useOrgMembers()
  const updateMembership = useUpdateMembership()
  const deleteMembership = useDeleteMembership()

  const [toRemove, setToRemove] = useState<OrgMember | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const columns = [
    columnHelper.accessor("email", {
      header: t("columnMember"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-full bg-muted">
            <UserIcon className="size-3.5 text-muted-foreground" />
          </div>
          <span className="font-medium">{row.original.email ?? row.original.user_id}</span>
        </div>
      ),
    }),
    columnHelper.accessor("role", {
      header: t("columnRole"),
      cell: ({ row }) => (
        <Select
          value={row.original.role}
          onValueChange={(value) =>
            updateMembership.mutate(
              { id: row.original.id, input: { role: value as OrgMember["role"] } },
              {
                onSuccess: () => toast.success(tCommon("updatedSuccess")),
                onError: () => toast.error(tCommon("genericError")),
              },
            )
          }
        >
          <SelectTrigger size="sm" className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["owner", "admin", "member"] as const).map((role) => (
              <SelectItem key={role} value={role}>
                {tRoles(ROLE_LABEL_KEY[role])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    }),
    columnHelper.accessor("created_at", {
      header: t("columnJoined"),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{new Date(getValue()).toLocaleDateString()}</span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="icon-sm" onClick={() => setToRemove(row.original)}>
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
        <Button onClick={() => setInviteOpen(true)}>
          <PlusIcon />
          {t("inviteMember")}
        </Button>
      </div>

      <EntityTable
        columns={columns}
        data={members ?? []}
        isLoading={isLoading}
        emptyMessage={t("noResults")}
      />

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("inviteDialogTitle")}</DialogTitle>
            <DialogDescription>{t("inviteNotWiredUp")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!toRemove}
        onOpenChange={(open) => !open && setToRemove(null)}
        isDeleting={deleteMembership.isPending}
        title={t("removeMember")}
        description={t("removeConfirmDescription")}
        onConfirm={() => {
          if (!toRemove) return
          deleteMembership.mutate(toRemove.id, {
            onSuccess: () => {
              toast.success(tCommon("deletedSuccess"))
              setToRemove(null)
            },
            onError: () => toast.error(tCommon("genericError")),
          })
        }}
      />
    </div>
  )
}
