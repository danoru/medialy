import { ProfileClient } from "@/app/profile/ProfileClient";
import { getProfileData } from "@/lib/db/profile";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const data = await getProfileData();
  return <ProfileClient data={JSON.parse(JSON.stringify(data))} />;
}
