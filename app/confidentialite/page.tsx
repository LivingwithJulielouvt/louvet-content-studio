import type { Metadata } from "next";
import LegalPage, { legalLang } from "../legal-page";
import { LEGAL_PAGES } from "../../lib/legal-copy.mjs";
export const dynamic = "force-dynamic";
export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const lang = legalLang((await searchParams).lang);
  return { title: (LEGAL_PAGES as any)["confidentialite"][lang].title + " · Louvet Content Studio" };
}
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <LegalPage slug="confidentialite" lang={legalLang((await searchParams).lang)} />;
}
