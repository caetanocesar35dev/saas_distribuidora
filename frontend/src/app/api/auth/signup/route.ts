import type { NextRequest } from "next/server";
import { callPublic, finishSessionStart, foreignOriginResponse, hasForeignOrigin } from "@/lib/server/bff";

export async function POST(req: NextRequest) {
  if (hasForeignOrigin(req)) return foreignOriginResponse();
  const body = await req.text();
  const result = await callPublic(req, "/auth/signup", {
    method: "POST",
    body: body || undefined,
  });
  return finishSessionStart(result);
}
