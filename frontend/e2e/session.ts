import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Sessões salvas na preparação (`global-setup.ts`): cada papel entra uma vez só. O login do
 * backend tem limite (5 por minuto e 20 por hora por e-mail), então os testes reaproveitam estes
 * arquivos em vez de entrar de novo. Só os testes do próprio login entram pela tela.
 */
export const AUTH_DIR = join(__dirname, ".auth");

export const STATE = {
  dono: join(AUTH_DIR, "dono.json"),
  gerente: join(AUTH_DIR, "gerente.json"),
  funcionario: join(AUTH_DIR, "funcionario.json"),
  admin: join(AUTH_DIR, "admin.json"),
} as const;

export type Role = keyof typeof STATE;

export const EMAIL: Record<Role, string> = {
  dono: "dono@exemplo.com",
  gerente: "gerente@exemplo.com",
  funcionario: "funcionario@exemplo.com",
  admin: "admin@plataforma.com",
};

/** O access token está no cookie `sd_at` da sessão salva (usado só para preparar dados no backend). */
export function accessTokenOf(role: Role): string {
  const state = JSON.parse(readFileSync(STATE[role], "utf8")) as {
    cookies: { name: string; value: string }[];
  };
  const cookie = state.cookies.find((c) => c.name === "sd_at");
  if (!cookie) throw new Error(`Sessão salva de ${role} sem access token. Rode os testes de novo.`);
  return cookie.value;
}
