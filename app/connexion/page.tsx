import { redirect } from "next/navigation";
import { getChatGPTUser } from "../chatgpt-auth";
import LoginPanel from "../login-panel";
import { studioDestination } from "../../lib/studio-navigation.mjs";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams,
    language = params.lang === "es" || params.lang === "en" ? params.lang : "fr",
    destination = studioDestination(params.next);
  if (await getChatGPTUser()) redirect(destination);
  return <LoginPanel initialLanguage={language} destination={destination} />;
}
