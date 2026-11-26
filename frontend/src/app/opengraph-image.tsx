import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo";

/** Imagem que aparece ao compartilhar o link no WhatsApp, Instagram, Facebook etc. */
export const alt = `${SITE_NAME}: sistema para distribuidora de bebidas`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Cor primária do sistema (--primary em globals.css), em hexadecimal para o gerador de imagem.
const PRIMARY = "#b0581c";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 60%)",
          color: "#1c1917",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 16,
              background: PRIMARY,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            M
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>{SITE_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>
            Sistema para distribuidora de bebidas
          </div>
          <div style={{ fontSize: 34, color: "#57534e" }}>
            PDV, caixa, estoque, comandas, fiado e vasilhame por cliente
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: PRIMARY, fontWeight: 700 }}>
          Teste grátis por 14 dias, sem cartão
        </div>
      </div>
    ),
    size,
  );
}
