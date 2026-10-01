import { InsightsClient } from "@/app/insights/InsightsClient";
import { getGenreInsightsByMediaType } from "@/lib/insights";
import { requireAdmin } from "@/lib/user";

export const dynamic = "force-dynamic";
export const metadata = { title: "Insights" };

export default async function InsightsPage() {
  // Admin-only for now while the page is reworked.
  await requireAdmin("/insights");
  const insightsByType = await getGenreInsightsByMediaType();

  return <InsightsClient insightsByType={insightsByType} />;
}
