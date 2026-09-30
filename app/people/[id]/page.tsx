import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PersonClient } from "@/components/people/PersonClient";
import { getPersonPageData } from "@/lib/db/people";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getPersonPageData(id);
  return { title: data?.person.name ?? "Person" };
}

/**
 * One person across everything they are credited on. Nothing is stored per
 * person: the page is derived on demand from the cached catalog.
 */
export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPersonPageData(id);
  if (!data) notFound();
  return <PersonClient basePath="/people" data={data} />;
}
