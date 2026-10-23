import type { NextRequest } from "next/server";
import { callPublic, json, foreignOriginResponse, hasForeignOrigin } from "@/lib/server/bff";
import { REFRESH_COOKIE } from "@/lib/server/config";
import { clearSessionCookies } from "@/lib/server/session";

/** Encerra a sessão deste aparelho: revoga o refresh token no backend e apaga os cookies. */
export async function POST(req: NextRequest) {
  if (hasForeignOrigin(req)) return foreignOriginResponse();
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await callPublic(req, "/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  }
  return json({ message: "Sessão encerrada." }, 200, clearSessionCookies);
}
