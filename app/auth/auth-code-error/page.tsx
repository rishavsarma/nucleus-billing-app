export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-xl font-semibold">Sign-in link didn&apos;t work</h1>
      <p className="text-muted-foreground text-sm">
        That link is invalid or has expired. Go back and try signing in again.
      </p>
    </div>
  )
}
