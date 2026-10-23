import type { NextRequest } from "next/server";
import { callWithSession, json, foreignOriginResponse, hasForeignOrigin } from "@/lib/server/bff";
import { clearSessionCookies } from "@/lib/server/session";

/** Encerra todas as sessões do usuário (todos os aparelhos) e apaga os cookies deste. */
export async function POST(req: NextRequest) {
  if (hasForeignOrigin(req)) return foreignOriginResponse();
  await callWithSession(req, "/auth/logout-all", { method: "POST" });
  return json(
    { message: "Todas as sessões foram encerradas." },
    200,
    clearSessionCookies,
  );
}
