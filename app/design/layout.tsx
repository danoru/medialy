import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/user";

// Internal design mockups: gate the whole subtree. Reading the session makes
// these routes dynamic, so the check runs on every request.
export default async function DesignLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin("/design");
  return children;
}
