"use server";

import { cookies } from "next/headers";

const FLASH_TOAST_COOKIE = "medialy_toast";
type ToastSeverity = "success" | "info" | "warning" | "error";

export async function queueToast(
  message: string,
  severity: ToastSeverity = "success",
) {
  const cookieStore = await cookies();
  cookieStore.set(
    FLASH_TOAST_COOKIE,
    encodeURIComponent(
      JSON.stringify({
        id: crypto.randomUUID(),
        message,
        severity,
      }),
    ),
    {
      httpOnly: false,
      maxAge: 30,
      path: "/",
      sameSite: "lax",
    },
  );
}
