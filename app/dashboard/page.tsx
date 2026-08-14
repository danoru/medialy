import { DashboardClient } from "@/app/dashboard/DashboardClient";
import { getDashboardData } from "@/lib/db/dashboard";
import { listCollections } from "@/lib/db/collections";
import { getCurrentUser } from "@/lib/user";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [data, user, collections] = await Promise.all([
    getDashboardData(),
    getCurrentUser(),
    listCollections({ includeDrafts: false }),
  ]);

  return (
    <DashboardClient
      collections={collections}
      data={JSON.parse(JSON.stringify(data))}
      isAuthenticated={Boolean(user)}
    />
  );
}
