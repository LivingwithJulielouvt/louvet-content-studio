import { createSupabaseServer } from "../../../lib/supabase/server";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default function LogoutPage() {
  return (
    <main className="louvet-public" style={{ minHeight: "100vh", padding: "12vh 24px", textAlign: "center" }}>
      <h1>Se déconnecter</h1>
      <p>Terminer votre session sur cet appareil.</p>
      <form action={signOut}>
        <button className="lp-button lp-primary" type="submit">
          Confirmer la déconnexion
        </button>
      </form>
      <p>
        <a href="/studio">Retour au studio</a>
      </p>
    </main>
  );
}
async function signOut() {
  "use server";
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/connexion");
}
