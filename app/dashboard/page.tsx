import { DashboardClient } from "@/app/dashboard/DashboardClient";
import { getDashboardData } from "@/lib/db/dashboard";
import { getCurrentUser } from "@/lib/user";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const [data, user] = await Promise.all([getDashboardData(), getCurrentUser()]);

  return (
    <DashboardClient
      data={JSON.parse(JSON.stringify(data))}
      isAdmin={Boolean(user?.isAdmin)}
      isAuthenticated={Boolean(user)}
    />
  );
}
