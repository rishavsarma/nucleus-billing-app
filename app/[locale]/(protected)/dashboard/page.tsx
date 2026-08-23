import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { redirect } from "@/i18n/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";

async function signOut() {
  "use server";
  const locale = await getLocale();
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect({ href: "/login", locale });
}

export default async function DashboardPage() {
  const t = await getTranslations("DashboardPage");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <LanguageSwitcher />
      </div>
      <p className="text-muted-foreground">{t("loggedInAs", { email: user?.email ?? "" })}</p>
      <form action={signOut}>
        <Button variant="outline" type="submit">{t("signOut")}</Button>
      </form>
    </div>
  );
}
