import DashboardPage from "@/app/dashboard/page";
import { DashboardStylePreview } from "./DashboardStylePreview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard style preview" };

/** Reuse the real dashboard so both treatments share exactly the same data. */
export default function RefinedDashboardPage() {
  return (
    <DashboardStylePreview>
      <DashboardPage />
    </DashboardStylePreview>
  );
}
