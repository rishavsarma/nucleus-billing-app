import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type StepperStep = {
  label: string
  done: boolean
  current: boolean
}

/**
 * Linear status-machine stepper for financial documents (invoices, bills,
 * credit/debit notes). Purely presentational — callers derive `steps` from
 * the document's actual `status` column, since status only ever moves
 * forward per the DB's transition-guard triggers (see CLAUDE.md).
 */
export function DocumentStepper({ steps }: { steps: StepperStep[] }) {
  return (
    <div className="flex items-center justify-center gap-0 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-0">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                step.done
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {step.done ? <CheckIcon className="size-3" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-sm",
                step.current ? "font-semibold" : "font-medium",
                step.done || step.current ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && <div className="mx-3 h-px w-9 bg-border" />}
        </div>
      ))}
    </div>
  )
}
