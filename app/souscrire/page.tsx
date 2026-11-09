import PublicSite from "../public-site";
export const dynamic = "force-dynamic";
export default async function Subscribe({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams,
    language = params.lang === "es" || params.lang === "en" ? params.lang : "fr";
  const country = typeof params.country === "string" ? params.country : undefined;
  return <PublicSite initialView="form" initialLanguage={language} initialCountry={country} />;
}
