import { describe, expect, it } from "vitest";
import { whatsappUrl } from "./contact";

describe("canais de contato", () => {
  it("abre o WhatsApp do suporte com a mensagem codificada", () => {
    expect(whatsappUrl("Olá & oi")).toBe("https://wa.me/5531975623307?text=Ol%C3%A1%20%26%20oi");
  });
});
