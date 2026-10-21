import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sem Cache Components / Partial Prefetching: a área logada é toda dinâmica (dados por
  // usuário, lidos no navegador) e o Cache Components manteria telas antigas montadas
  // (Activity) ao navegar, o que atrapalha telas de dados como PDV e caixa.
  poweredByHeader: false,
  turbopack: {
    // O repositório tem outro package-lock.json na raiz; fixa a raiz do projeto no frontend.
    root: dirname(fileURLToPath(import.meta.url)),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
