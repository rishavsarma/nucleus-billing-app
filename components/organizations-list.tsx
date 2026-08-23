"use client"

import { useOrganizations } from "@/hooks/use-organizations"

export function OrganizationsList() {
  const { data, isLoading, isError, error } = useOrganizations()

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading organizations…</p>
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Failed to load organizations: {error instanceof Error ? error.message : "Unknown error"}
      </p>
    )
  }

  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">No organizations found.</p>
  }

  return (
    <ul className="text-sm">
      {data.map((org) => (
        <li key={org.id}>{org.name}</li>
      ))}
    </ul>
  )
}
