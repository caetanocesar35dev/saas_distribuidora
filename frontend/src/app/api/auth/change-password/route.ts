import type { NextRequest } from "next/server";
import { callWithSession, finishSessionStart, foreignOriginResponse, hasForeignOrigin } from "@/lib/server/bff";

/** A troca de senha encerra as outras sessões e devolve um par novo de tokens para este aparelho. */
export async function POST(req: NextRequest) {
  if (hasForeignOrigin(req)) return foreignOriginResponse();
  const body = await req.text();
  const result = await callWithSession(req, "/auth/change-password", {
    method: "POST",
    body: body || undefined,
    contentType: req.headers.get("content-type"),
  });
  return finishSessionStart(result);
}
