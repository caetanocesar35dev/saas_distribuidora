# Frontend

SPA em React 19 + Vite 8 + TailwindCSS 4, servida em `http://localhost:5173`.

> O código de `src/` é da versão anterior (uma distribuidora só) e será refeito conforme
> o [plano de implementação do frontend](../plano_implementacao_frontend.md).

## Scripts

```bash
npm install
npm run dev       # desenvolvimento
npm run build     # build de produção em dist/
npm run preview   # serve o build localmente
npm run lint      # oxlint
```

## Configuração

| Variável | Padrão | Uso |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3001/api` | URL da API do backend |

Pode ser definida em `frontend/.env` (fora do git).
