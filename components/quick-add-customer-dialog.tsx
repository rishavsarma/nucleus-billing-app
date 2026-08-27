"use client"

import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PartyForm, formValuesToPartyInput, type PartyFormValues } from "@/components/party-form"
import { useCreateCustomer } from "@/hooks/use-customers"

export function QuickAddCustomerDialog({
  open,
  onOpenChange,
  onCreated,
  container,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (customerId: string) => void
  /** Portal target — defaults to document.body. Pass e.g. a fullscreened
   * element's ref so this still renders during Fullscreen. */
  container?: HTMLElement | null
}) {
  const t = useTranslations("Customers")
  const tFields = useTranslations("PartyFields")
  const tCommon = useTranslations("Common")
  const createCustomer = useCreateCustomer()

  function onSubmit(values: PartyFormValues) {
    createCustomer.mutate(formValuesToPartyInput(values), {
      onSuccess: (customer) => {
        toast.success(tCommon("createdSuccess"))
        onCreated(customer.id)
        onOpenChange(false)
      },
      onError: () => toast.error(tCommon("genericError")),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl" container={container}>
        <DialogHeader>
          <DialogTitle>{t("newCustomer")}</DialogTitle>
        </DialogHeader>
        <PartyForm
          onSubmit={onSubmit}
          isSubmitting={createCustomer.isPending}
          nameLabel={t("nameLabel")}
          basicDetailsTitle={tFields("basicDetailsTitle")}
          basicDetailsDescription={t("basicDetailsDescription")}
          addressTitle={tFields("addressTitle")}
          addressDescription={t("addressDescription")}
          submitLabel={tCommon("create")}
        />
      </DialogContent>
    </Dialog>
  )
}
