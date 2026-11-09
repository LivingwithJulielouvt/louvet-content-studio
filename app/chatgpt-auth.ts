// Compatibilité avec les composants existants : l’identité est maintenant vérifiée par Supabase.
import { redirect } from "next/navigation";
import { verifiedStudioUser } from "../lib/supabase/server";
import { studioLoginPath } from "../lib/studio-navigation.mjs";
export type ChatGPTUser = { userId: string; displayName: string; email: string; fullName: string | null };
export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const user = await verifiedStudioUser();
  return user ? { userId: user.id, displayName: user.email, email: user.email, fullName: null } : null;
}
export async function requireChatGPTUser(returnTo: string) {
  const user = await getChatGPTUser();
  if (!user) redirect(studioLoginPath(returnTo));
  return user;
}
export function chatGPTSignInPath(returnTo: string) {
  return studioLoginPath(returnTo);
}
export function chatGPTSignOutPath() {
  return "/auth/logout";
}
