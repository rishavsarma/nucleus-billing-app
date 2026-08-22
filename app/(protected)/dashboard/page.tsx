import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">Logged in as {user?.email}</p>
      <form action={signOut}>
        <Button variant="outline" type="submit">Sign out</Button>
      </form>
    </div>
  );
}