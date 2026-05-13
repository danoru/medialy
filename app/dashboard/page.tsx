import { DashboardClient } from "@/app/dashboard/DashboardClient";
import { getDashboardData } from "@/lib/db/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return <DashboardClient data={JSON.parse(JSON.stringify(data))} />;
}
