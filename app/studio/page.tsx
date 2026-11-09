import Studio from "../studio-ui";
import BetaChrome from "../beta-chrome";
import { requireChatGPTUser } from "../chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function StudioPage() {
  await requireChatGPTUser("/studio");
  return (
    <>
      <BetaChrome />
      <Studio />
    </>
  );
}
