"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { isAxiosError } from "axios"
import { CheckIcon, CopyIcon } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EntityFormDialog } from "@/components/entity-form-dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreateOrgUser } from "@/hooks/use-admin-org-users"
import type { CreateOrgUserResult } from "@/lib/services/admin-org-users"
import type { Membership } from "@/lib/database/types"

const addUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "member"]),
})
type AddUserFormValues = z.infer<typeof addUserSchema>

const ROLE_OPTIONS: Membership["role"][] = ["owner", "admin", "member"]

export function AddOrgUserDialog({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("AdminOrganizations")
  const tRoles = useTranslations("Roles")
  const tCommon = useTranslations("Common")
  const createOrgUser = useCreateOrgUser()

  const [created, setCreated] = useState<CreateOrgUserResult | null>(null)
  const [copied, setCopied] = useState(false)

  const form = useForm<AddUserFormValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { email: "", role: "owner" },
  })
  const role = useWatch({ control: form.control, name: "role" })

  function onSubmit(values: AddUserFormValues) {
    createOrgUser.mutate(
      { orgId, email: values.email, role: values.role },
      {
        onSuccess: (result) => {
          setCreated(result)
          form.reset({ email: "", role: "owner" })
        },
        onError: (error) => {
          const message = isAxiosError<{ error?: string }>(error) ? error.response?.data?.error : undefined
          toast.error(message ?? tCommon("genericError"))
        },
      },
    )
  }

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setCreated(null)
      setCopied(false)
    }
    onOpenChange(nextOpen)
  }

  if (created) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("userCreatedTitle")}</DialogTitle>
            <DialogDescription>{t("userCreatedDescription")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Field>
              <FieldLabel>{t("userEmailLabel")}</FieldLabel>
              <Input readOnly value={created.email} />
            </Field>
            <Field>
              <FieldLabel>{t("temporaryPasswordLabel")}</FieldLabel>
              <div className="flex gap-2">
                <Input readOnly value={created.temporaryPassword} className="font-mono" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(created.temporaryPassword)
                    setCopied(true)
                    toast.success(t("copied"))
                  }}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </Button>
              </div>
            </Field>
          </div>
          <DialogFooter>
            <Button onClick={() => handleClose(false)}>{t("done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={handleClose}
      title={t("addUserDialogTitle")}
      description={t("addUserDialogDescription")}
      onSubmit={form.handleSubmit(onSubmit)}
      isSubmitting={createOrgUser.isPending}
      submitLabel={t("createUser")}
    >
      <Field>
        <FieldLabel htmlFor="add-user-email">{t("userEmailLabel")}</FieldLabel>
        <Input id="add-user-email" type="email" {...form.register("email")} />
      </Field>
      <Field>
        <FieldLabel htmlFor="add-user-role">{t("roleLabel")}</FieldLabel>
        <Select value={role} onValueChange={(value) => form.setValue("role", value as Membership["role"])}>
          <SelectTrigger id="add-user-role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {tRoles(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </EntityFormDialog>
  )
}
