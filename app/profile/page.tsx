import { ProfileClient } from "@/app/profile/ProfileClient";
import { getProfileData } from "@/lib/db/profile";
import { getCurrentUser } from "@/lib/user";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const [data, user] = await Promise.all([getProfileData(), getCurrentUser()]);
  return (
    <ProfileClient
      data={JSON.parse(JSON.stringify(data))}
      isAdmin={user?.isAdmin ?? false}
    />
  );
}
