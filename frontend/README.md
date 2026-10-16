# Frontend

> **Este código é o legado** (React 19 + Vite 8 + TailwindCSS 4, em JavaScript, para uma
> distribuidora só). O frontend será **refeito em Next.js (App Router) + React +
> TypeScript + Tailwind CSS**, conforme o
> [plano de implementação do frontend](../plano_implementacao_frontend.md). As telas daqui
> servem só de referência visual e de fluxo.

## Como rodar o legado

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # build de produção em dist/
npm run preview   # serve o build localmente
npm run lint      # oxlint
```

| Variável | Padrão | Uso |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001/api` | URL da API do backend |

O legado fala com a API antiga e **não funciona com o backend atual** (multi-tenant).
