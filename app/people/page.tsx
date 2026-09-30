import { PeopleClient } from "@/components/people/PeopleClient";
import { getPeopleHubData } from "@/lib/db/people";

export const dynamic = "force-dynamic";
export const metadata = { title: "People" };

/**
 * The People hub: search everyone credited in the catalog, and see whose work
 * you rate highest. Computed from the cached catalog on each request.
 */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const data = await getPeopleHubData(q);
  return <PeopleClient basePath="/people" data={data} />;
}
