import { redirect } from "next/navigation";
import { getChatGPTUser } from "../chatgpt-auth";
import { studioLoginPath } from "../../lib/studio-navigation.mjs";
export const dynamic = "force-dynamic";
// Old bookmarks and unknown studio pages never expose an unauthenticated screen.
export default async function ProtectedFallback() {
  redirect((await getChatGPTUser()) ? "/studio" : studioLoginPath("/studio"));
}
