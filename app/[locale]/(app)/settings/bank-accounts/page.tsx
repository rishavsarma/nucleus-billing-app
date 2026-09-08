"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { PencilIcon, PlusIcon, StarIcon, TrashIcon } from "lucide-react"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { EntityFormDialog } from "@/components/entity-form-dialog"
import { EntityTable, entityColumnHelper } from "@/components/entity-table"
import { useServerTableParams } from "@/components/server-table"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  useCreateOrganizationBankAccount,
  useDeleteOrganizationBankAccount,
  useOrganizationBankAccountsList,
  useUpdateOrganizationBankAccount,
} from "@/hooks/use-organization-bank-accounts"
import type { OrganizationBankAccount } from "@/lib/database/types"

const columnHelper = entityColumnHelper<OrganizationBankAccount>()

const bankAccountSchema = z.object({
  account_holder_name: z.string().min(1),
  account_number: z.string().min(1),
  ifsc_code: z.string().min(1),
  bank_name: z.string().min(1),
  branch_name: z.string().optional(),
  is_default: z.boolean(),
})
type BankAccountFormValues = z.infer<typeof bankAccountSchema>

function toFormValues(
  account?: OrganizationBankAccount
): BankAccountFormValues {
  return {
    account_holder_name: account?.account_holder_name ?? "",
    account_number: account?.account_number ?? "",
    ifsc_code: account?.ifsc_code ?? "",
    bank_name: account?.bank_name ?? "",
    branch_name: account?.branch_name ?? "",
    is_default: account?.is_default ?? false,
  }
}

export default function BankAccountsPage() {
  const t = useTranslations("BankAccounts")
  const tCommon = useTranslations("Common")
  const { params, tableControlProps } = useServerTableParams()
  const { data: result, isLoading } = useOrganizationBankAccountsList(params)
  const createBankAccount = useCreateOrganizationBankAccount()
  const updateBankAccount = useUpdateOrganizationBankAccount()
  const deleteBankAccount = useDeleteOrganizationBankAccount()

  const [editing, setEditing] = useState<
    OrganizationBankAccount | "new" | null
  >(null)
  const [toDelete, setToDelete] = useState<OrganizationBankAccount | null>(null)

  const form = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountSchema),
    values: toFormValues(editing && editing !== "new" ? editing : undefined),
  })
  const { register, handleSubmit, formState, setValue, control } = form
  const isDefault = useWatch({ control, name: "is_default" })

  const isSaving = createBankAccount.isPending || updateBankAccount.isPending

  function onSubmit(values: BankAccountFormValues) {
    const input = { ...values, branch_name: values.branch_name || null }
    if (editing && editing !== "new") {
      updateBankAccount.mutate(
        { id: editing.id, input },
        {
          onSuccess: () => {
            toast.success(tCommon("updatedSuccess"))
            setEditing(null)
          },
          onError: () => toast.error(tCommon("genericError")),
        }
      )
    } else {
      createBankAccount.mutate(input, {
        onSuccess: () => {
          toast.success(tCommon("createdSuccess"))
          setEditing(null)
        },
        onError: () => toast.error(tCommon("genericError")),
      })
    }
  }

  const columns = [
    columnHelper.accessor("account_holder_name", {
      header: t("columnAccountHolder"),
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium">
            {row.original.account_holder_name}
          </span>
          {row.original.is_default ? (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <StarIcon className="size-3" />
              {t("defaultBadge")}
            </Badge>
          ) : null}
        </div>
      ),
    }),
    columnHelper.accessor("bank_name", { header: t("columnBank") }),
    columnHelper.accessor("account_number", {
      header: t("columnAccountNumber"),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{getValue()}</span>
      ),
    }),
    columnHelper.accessor("ifsc_code", {
      header: t("columnIfsc"),
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{getValue()}</span>
      ),
    }),
    columnHelper.display({
      id: "actions",
      header: () => null,
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setEditing(row.original)}
          >
            <PencilIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setToDelete(row.original)}
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
        <Button onClick={() => setEditing("new")}>
          <PlusIcon />
          {t("newBankAccount")}
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

      <EntityFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing !== "new" ? t("editBankAccount") : t("newBankAccount")}
        description={
          editing !== "new" ? t("editDescription") : t("newDescription")
        }
        onSubmit={handleSubmit(onSubmit)}
        isSubmitting={isSaving}
        submitLabel={editing !== "new" ? tCommon("save") : tCommon("create")}
      >
        <Field data-invalid={!!formState.errors.account_holder_name}>
          <FieldLabel htmlFor="ba-holder">{t("accountHolderLabel")}</FieldLabel>
          <Input
            id="ba-holder"
            placeholder={t("accountHolderPlaceholder")}
            {...register("account_holder_name")}
          />
          {formState.errors.account_holder_name ? (
            <FieldError>{tCommon("required")}</FieldError>
          ) : null}
        </Field>
        <Field data-invalid={!!formState.errors.bank_name}>
          <FieldLabel htmlFor="ba-bank">{t("bankNameLabel")}</FieldLabel>
          <Input
            id="ba-bank"
            placeholder={t("bankNamePlaceholder")}
            {...register("bank_name")}
          />
          {formState.errors.bank_name ? (
            <FieldError>{tCommon("required")}</FieldError>
          ) : null}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field data-invalid={!!formState.errors.account_number}>
            <FieldLabel htmlFor="ba-number">
              {t("accountNumberLabel")}
            </FieldLabel>
            <Input
              id="ba-number"
              placeholder={t("accountNumberPlaceholder")}
              {...register("account_number")}
            />
            {formState.errors.account_number ? (
              <FieldError>{tCommon("required")}</FieldError>
            ) : null}
          </Field>
          <Field data-invalid={!!formState.errors.ifsc_code}>
            <FieldLabel htmlFor="ba-ifsc">{t("ifscLabel")}</FieldLabel>
            <Input
              id="ba-ifsc"
              placeholder={t("ifscPlaceholder")}
              {...register("ifsc_code")}
            />
            {formState.errors.ifsc_code ? (
              <FieldError>{tCommon("required")}</FieldError>
            ) : null}
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="ba-branch">{t("branchLabel")}</FieldLabel>
          <Input
            id="ba-branch"
            placeholder={t("branchPlaceholder")}
            {...register("branch_name")}
          />
        </Field>
        <Field orientation="horizontal">
          <FieldLabel htmlFor="ba-default">{t("defaultLabel")}</FieldLabel>
          <Switch
            id="ba-default"
            checked={isDefault}
            onCheckedChange={(checked) => setValue("is_default", checked)}
          />
        </Field>
      </EntityFormDialog>

      <DeleteConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        isDeleting={deleteBankAccount.isPending}
        description={t("deleteDescription")}
        onConfirm={() => {
          if (!toDelete) return
          deleteBankAccount.mutate(toDelete.id, {
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
