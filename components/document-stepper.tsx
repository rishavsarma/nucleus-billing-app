import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type StepperStep = {
  label: string
  done: boolean
  current: boolean
  description?: string
}

/**
 * Linear status-machine stepper for financial documents (invoices, bills,
 * credit/debit notes) and multi-step creation flows.
 */
export function DocumentStepper({
  steps,
  className,
}: {
  steps: StepperStep[]
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-start sm:justify-center gap-0 rounded-xl bg-card p-3 sm:p-4 ring-1 ring-foreground/10 overflow-x-auto whitespace-nowrap -mx-3 sm:mx-0",
        className
      )}
    >
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-0 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                step.done
                  ? "bg-primary text-primary-foreground"
                  : step.current
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {step.done ? <CheckIcon className="size-3.5 stroke-[2.5]" /> : i + 1}
            </div>
            <div className="flex flex-col">
              <span
                className={cn(
                  "text-sm",
                  step.current
                    ? "font-semibold text-foreground"
                    : step.done
                    ? "font-medium text-foreground"
                    : "font-medium text-muted-foreground"
                )}
              >
                {step.label}
              </span>
              {step.description ? (
                <span className="text-xs text-muted-foreground">
                  {step.description}
                </span>
              ) : null}
            </div>
          </div>
          {i < steps.length - 1 && (
            <div
              className={cn(
                "mx-4 h-0.5 w-12 transition-colors",
                step.done ? "bg-primary" : "bg-border"
              )}
            />
          )}
        </div>
      ))}
    </div>
  )
}
