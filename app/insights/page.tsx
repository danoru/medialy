import { InsightsClient } from "@/app/insights/InsightsClient";
import { getGenreInsightsByMediaType } from "@/lib/insights";

export const dynamic = "force-dynamic";
export const metadata = { title: "Insights" };

export default async function InsightsPage() {
  const insightsByType = await getGenreInsightsByMediaType();

  return <InsightsClient insightsByType={insightsByType} />;
}
