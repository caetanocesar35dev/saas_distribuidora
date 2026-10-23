import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta. Precisam do banco, do backend (porta 3001) e dos dados do seed
 * (`npm run db:seed` em backend/). O Next sobe sozinho (ou reaproveita o que já está rodando).
 * Os testes gravam dados de verdade no banco de desenvolvimento: rode só em ambiente local.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // O banco é compartilhado, então os testes rodam um de cada vez.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    viewport: { width: 1280, height: 860 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
