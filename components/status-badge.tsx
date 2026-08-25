import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { statusTone, type StatusTone } from "@/lib/status"

const DOT_CLASS: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground",
  info: "bg-blue-500",
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  danger: "bg-destructive",
}

/**
 * Renders a status/role string as a colored badge. Pass the already-translated
 * label as children — this component only owns the color, never the copy.
 */
export function StatusBadge({
  status,
  children,
  className,
}: {
  status: string
  children: React.ReactNode
  className?: string
}) {
  const tone = statusTone(status)
  return (
    <Badge variant="outline" className={cn("gap-1.5", className)}>
      <span className={cn("size-1.5 rounded-full", DOT_CLASS[tone])} />
      {children}
    </Badge>
  )
}
