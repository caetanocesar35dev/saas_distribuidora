/**
 * Gera docs/API.md (lista de rotas, quem pode chamar cada uma e o que acontece em somente
 * leitura) lendo os metadados reais dos controllers. Rode sempre que mudar rotas ou permissões:
 *
 *   npm run docs:api
 */
import 'dotenv/config';
import { ModulesContainer, NestFactory } from '@nestjs/core';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import {
  ALLOW_READ_ONLY_KEY,
  BILLING_OWNER_KEY,
  COMPANY_ROLE_KEY,
  IS_PUBLIC_KEY,
  PLATFORM_ROLE_KEY,
  STORE_ROLE_KEY,
} from '../src/common/decorators/access.decorators';

const METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'ALL',
  'OPTIONS',
  'HEAD',
];
const PREFIX = '/api';

interface Row {
  tag: string;
  method: string;
  path: string;
  access: string;
  readOnly: string;
}

const join2 = (...parts: string[]) =>
  '/' +
  parts
    .flatMap((p) => p.split('/'))
    .filter(Boolean)
    .join('/');

function metadata<T>(key: string, fn: object, ctor: object): T | undefined {
  return (Reflect.getMetadata(key, fn) ?? Reflect.getMetadata(key, ctor)) as
    T | undefined;
}

function describeAccess(path: string, fn: object, ctor: object): string {
  if (metadata<boolean>(IS_PUBLIC_KEY, fn, ctor)) return 'Pública (sem login)';
  const platform = metadata<string[]>(PLATFORM_ROLE_KEY, fn, ctor);
  if (platform) return `Plataforma: ${platform.join(' ou ')}`;
  if (path.includes(':storeId'))
    return `Loja: ${metadata<string>(STORE_ROLE_KEY, fn, ctor) ?? 'EMPLOYEE'} ou mais`;
  if (path.includes(':companyId'))
    return `Empresa: ${metadata<string>(COMPANY_ROLE_KEY, fn, ctor) ?? 'EMPLOYEE'} ou mais`;
  if (path.includes(':organizationId')) {
    return metadata<boolean>(BILLING_OWNER_KEY, fn, ctor)
      ? 'Responsável pela cobrança'
      : 'Membro da organização';
  }
  return 'Qualquer usuário logado';
}

function describeReadOnly(
  path: string,
  method: string,
  fn: object,
  ctor: object,
  access: string,
): string {
  const tenantScoped = /:(storeId|companyId|organizationId)/.test(path);
  if (
    !tenantScoped ||
    access.startsWith('Plataforma') ||
    access.startsWith('Pública')
  )
    return '—';
  if (method === 'GET') return 'Funciona';
  return metadata<boolean>(ALLOW_READ_ONLY_KEY, fn, ctor)
    ? '**Funciona (exceção)**'
    : 'Bloqueada (402)';
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const rows: Row[] = [];

  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const ctor = wrapper.metatype as {
        prototype: Record<string, unknown>;
      } | null;
      if (!ctor?.prototype) continue;
      const basePath =
        (Reflect.getMetadata('path', ctor) as string | undefined) ?? '';
      const tag = ((Reflect.getMetadata('swagger/apiUseTags', ctor) as
        string[] | undefined) ?? [ctor.constructor.name])[0];

      for (const name of Object.getOwnPropertyNames(ctor.prototype)) {
        const fn = ctor.prototype[name] as object;
        const methodIndex =
          typeof fn === 'function'
            ? (Reflect.getMetadata('method', fn) as number | undefined)
            : undefined;
        if (methodIndex === undefined) continue;

        const route =
          (Reflect.getMetadata('path', fn) as string | undefined) ?? '/';
        const path = join2(PREFIX, basePath, route);
        const method = METHODS[methodIndex];
        const access = describeAccess(path, fn, ctor);
        rows.push({
          tag,
          method,
          path,
          access,
          readOnly: describeReadOnly(path, method, fn, ctor, access),
        });
      }
    }
  }
  await app.close();

  const order = (m: string) => METHODS.indexOf(m);
  rows.sort(
    (a, b) =>
      a.tag.localeCompare(b.tag) ||
      a.path.localeCompare(b.path) ||
      order(a.method) - order(b.method),
  );

  const byTag = new Map<string, Row[]>();
  for (const r of rows) byTag.set(r.tag, [...(byTag.get(r.tag) ?? []), r]);

  const lines: string[] = [
    '# API: rotas e permissões',
    '',
    '> **Arquivo gerado** por `npm run docs:api` a partir do código (controllers e decorators). Não edite à mão:',
    '> rode o comando de novo ao mudar rotas ou permissões. A documentação interativa (Swagger, com os',
    '> corpos e as respostas) fica em `/api/docs` fora de produção.',
    '',
    `Total: **${rows.length} rotas**. Todas começam com \`${PREFIX}\`.`,
    '',
    '## Como ler',
    '',
    '- **Quem pode:** o papel mínimo. Hierarquia por loja: `OWNER` > `MANAGER` > `EMPLOYEE`. Em rotas de empresa, vale o maior papel do usuário em alguma loja dela.',
    '- **Recurso de outra empresa/loja → 404** (nunca 403), para não revelar que existe. Papel insuficiente dentro do próprio tenant → 403.',
    '- **Somente leitura:** quando a assinatura está vencida (teste acabou, atraso depois da carência ou cancelada), as leituras (`GET`) continuam e as escritas respondem **402** `{ code: "SUBSCRIPTION_READ_ONLY", reason }`, exceto as marcadas "Funciona (exceção)": fechar o caixa já aberto.',
    '- Rotas fora de empresa/loja (`/auth`, `/me`, `/plans`, `/platform`) não dependem da assinatura (—).',
    '- Os ids de empresa e loja ficam **na URL** (`:companyId`, `:storeId`), nunca em headers.',
    '',
    '## Regras que dependem do conteúdo da requisição',
    '',
    '- `POST /stores/:storeId/cash-register/movements`: entrada (`IN`) é de funcionário; **saída (`OUT`) exige gerente**.',
    '- `POST /stores/:storeId/bottle-movements`: envio/recebimento de fornecedor é de funcionário; **`MANUAL_ADJUSTMENT` exige gerente**.',
    '- `GET /companies/:companyId/customers/:id/balances` e `/payments`: **funcionário só vê as lojas dele e não recebe o `total`**; gerente e dono veem tudo.',
    '- `POST /stores/:storeId/customers/:customerId/bottle-returns`: a devolução só abate a dívida **da própria loja** (409 se o cliente deve em outra).',
    '- Rotas `/platform/*`: `SUPPORT` só lê; `SUPERADMIN` lê e escreve (cada escrita aparece como "Plataforma: SUPERADMIN").',
    '',
  ];

  for (const [tag, list] of byTag) {
    lines.push(
      `## ${tag}`,
      '',
      '| Método | Rota | Quem pode | Em somente leitura |',
      '|---|---|---|---|',
    );
    for (const r of list)
      lines.push(
        `| ${r.method} | \`${r.path}\` | ${r.access} | ${r.readOnly} |`,
      );
    lines.push('');
  }

  const file = join(__dirname, '..', '..', 'docs', 'API.md');
  writeFileSync(file, lines.join('\n'), 'utf8');
  console.log(`docs/API.md gerado com ${rows.length} rotas.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
