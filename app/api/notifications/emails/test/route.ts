import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { sendTestEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) {
      return Response.json({ ok: false, error: "Email is required" }, { status: 400 });
    }
    const result = await sendTestEmail(email);
    if (!result.ok) {
      return Response.json({ ok: false, error: result.error ?? "Failed to send" }, { status: 400 });
    }
    return Response.json({ ok: true, message: "Test email sent. Check your inbox." });
  } catch (e) {
    console.error("POST /api/notifications/emails/test error:", e);
    return Response.json({ ok: false, error: "Failed to send test email" }, { status: 500 });
  }
}
