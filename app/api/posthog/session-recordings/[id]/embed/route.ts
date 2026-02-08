import { NextRequest } from "next/server";
import { posthogGet, posthogPatch, posthogPost, POSTHOG_EMBED_BASE } from "@/lib/posthog-api";

type SharingResponse = {
  enabled?: boolean;
  access_token?: string;
  accessToken?: string;
};

function getToken(data: SharingResponse): string | undefined {
  return data?.access_token ?? data?.accessToken;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let token: string | undefined;

    try {
      const existing = await posthogGet<SharingResponse>(`/session_recordings/${id}/sharing/`);
      if (existing?.enabled) token = getToken(existing);
    } catch {
      // sharing not yet enabled
    }

    if (!token) {
      try {
        const updated = await posthogPatch<SharingResponse>(
          `/session_recordings/${id}/sharing/`,
          { enabled: true }
        );
        token = getToken(updated);
      } catch {
        const refreshed = await posthogPost<SharingResponse>(
          `/session_recordings/${id}/sharing/refresh/`,
          { enabled: true }
        );
        token = getToken(refreshed);
      }
    }

    if (!token) {
      return Response.json(
        { error: "Could not get embed token for this recording" },
        { status: 400 }
      );
    }

    return Response.json({
      embedUrl: `${POSTHOG_EMBED_BASE}/${token}`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
