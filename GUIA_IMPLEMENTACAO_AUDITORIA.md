# Guia de Implementação: Auditoria com Triggers PostgreSQL + Interceptor NestJS

> **Público-alvo:** agente de IA (ou dev) que vai replicar este padrão de auditoria em **outro projeto**.
> Siga as seções na ordem. Os blocos marcados com `<PLACEHOLDER>` devem ser substituídos.
> Projeto de referência: NestJS 11 + Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL.

---

## 0. Resumo em uma frase

A **aplicação** só grava *quem* e *de onde* veio a alteração em colunas da própria tabela de negócio; o **banco**, via trigger `AFTER INSERT OR UPDATE ... FOR EACH ROW`, copia cada nova versão da linha para uma tabela de histórico `th_*_hist` no padrão **SCD Tipo 2** (intervalo `dh_inicio_hist`/`dh_fim_hist`).

## 1. Arquitetura (fluxo de uma requisição)

```
HTTP POST/PUT/PATCH/DELETE  (Authorization: Bearer <jwt>)
        │
        ▼
JwtAuthGuard ─────────────── valida o JWT e grava o payload em request.user  (sub = UUID do usuário)
        │                    (no Nest, guards SEMPRE rodam antes dos interceptors)
        ▼
AuditInterceptor ─────────── se method != GET e existe request.user:
        │                      request.body = { ...body, co_uuid_1: user.sub, no_endpoint_modificador: request.url }
        ▼
Pipes (ValidationPipe) ───── ATENÇÃO: rodam DEPOIS do interceptor (ver Armadilha A)
        ▼
Controller → Service ─────── repassa os campos de auditoria no `data` do Prisma (create/update/updateMany)
        ▼
PostgreSQL: INSERT/UPDATE em tb_<entidade>   (colunas co_uuid_1 e no_endpoint_modificador preenchidas)
        ▼
TRIGGER tr_auditoria_tb_<entidade>  (AFTER INSERT OR UPDATE, FOR EACH ROW)
        ├─ se UPDATE: fecha a versão vigente  → UPDATE th_..._hist SET dh_fim_hist = now() WHERE id = OLD.id AND dh_fim_hist IS NULL
        └─ sempre:    insere nova versão      → INSERT INTO th_..._hist (...colunas..., dh_inicio_hist) VALUES (NEW...., now())
```

Tudo roda **na mesma transação** do comando original: se o trigger falhar, a alteração inteira sofre rollback.
Um `updateMany` do Prisma vira um único `UPDATE ... WHERE id IN (...)`, e o trigger dispara **uma vez por linha**, então cada registro ganha sua versão no histórico.

## 2. Convenções de nomenclatura (manter no projeto alvo)

| Item | Padrão | Exemplo |
|---|---|---|
| Tabela de negócio | `tb_<entidade>` | `tb_produto` |
| PK sequencial | `co_seq_<entidade>` | `co_seq_produto` |
| Tabela de histórico | `th_<entidade>_hist` | `th_produto_hist` |
| PK do histórico | `co_seq_<entidade>_hist` | `co_seq_produto_hist` |
| UUID do usuário que alterou | `co_uuid_1` | (valor = `sub` do JWT) |
| Endpoint que alterou | `no_endpoint_modificador` | `/produtos/12` |
| Início/fim de vigência | `dh_inicio_hist` / `dh_fim_hist` | `dh_fim_hist IS NULL` = versão vigente |
| Função do trigger | `fc_auditoria_tb_<entidade>` | `fc_auditoria_tb_produto` |
| Trigger | `tr_auditoria_tb_<entidade>` | `tr_auditoria_tb_produto` |

Prefixos de coluna: `co_` código/ID, `ds_` descrição, `st_` status/booleano, `dh_` data-hora, `no_` nome, `vl_` valor.
Se o projeto alvo já tiver outra convenção, adapte os nomes, mas use a mesma estrutura.

---

## 3. Passo a passo de implementação

### Passo 1: pré-requisitos no projeto alvo

1. Banco **PostgreSQL** (o trigger é PL/pgSQL).
2. Autenticação que coloque o usuário em `request.user`, com o ID dele em `request.user.sub` (JWT padrão). Se o projeto usar Passport/outro campo, ajuste o interceptor (Passo 3).
3. Prisma com migrations (`prisma migrate`). Se for outro ORM, a parte do banco é idêntica; só muda a forma de passar os campos no `data`.

### Passo 2: schema Prisma (tabela de negócio + histórico)

Para **cada entidade auditada**:

```prisma
model tb_<entidade> {
  co_seq_<entidade> Int     @id @default(autoincrement())
  // ... colunas de negócio (ex.: ds_nome String, st_ativo Boolean @default(true)) ...

  // Campos de Auditoria (preenchidos pela aplicação via interceptor)
  co_uuid_1               String?
  no_endpoint_modificador String?
  dh_criacao              DateTime @default(now())
  dh_alteracao            DateTime @default(now()) @updatedAt
}

model th_<entidade>_hist {
  co_seq_<entidade>_hist Int @id @default(autoincrement())
  co_seq_<entidade>      Int          // FK lógica (sem @relation, de propósito: o histórico sobrevive à exclusão do registro original)
  // ... MESMAS colunas de negócio da tb_, com os mesmos tipos, mas SEM @default ...

  // Campos de Auditoria Histórico
  co_uuid_1               String?
  no_endpoint_modificador String?
  dh_inicio_hist          DateTime
  dh_fim_hist             DateTime?

  @@index([co_seq_<entidade>, dh_fim_hist])  // recomendado: acelera o UPDATE que fecha a versão vigente
}
```

Regras:
- A `th_` **não** tem relação Prisma com a `tb_`, e nenhum código da aplicação escreve nela. Só o trigger escreve; a aplicação apenas lê (`findMany` ordenado por `dh_inicio_hist`).
- Colunas de negócio na `th_` sem `@default`/`@updatedAt`: o valor vem sempre de `NEW.<coluna>`.
- `dh_criacao`/`dh_alteracao` ficam só na `tb_` (não são copiadas ao histórico no projeto de referência; `dh_inicio_hist` cumpre esse papel).

### Passo 3: interceptor de auditoria (código de referência)

`src/interceptors/audit.interceptor.ts`:

```ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Se não for GET e tiver um user no request (colocado pelo JwtAuthGuard)
    if (request.method !== 'GET' && request.user) {
      // Injeta o UUID e a URL no corpo da requisição
      request.body = {
        ...request.body,
        co_uuid_1: request.user.sub,
        no_endpoint_modificador: request.url,
      };
    }

    return next.handle();
  }
}
```

Pontos importantes:
- O spread vem **antes** dos campos injetados, então se o cliente mandar `co_uuid_1` no body, o valor dele é **sobrescrito** pelo do token. Mantenha essa ordem.
- `request.url` inclui query string (`/produtos/1?x=y`). Se quiser só a rota, use `request.route?.path` (padrão, ex.: `/produtos/:id`) ou `request.originalUrl.split('?')[0]`.

Guard de referência (`src/auth/jwt-auth.guard.ts`): extrai `Bearer <token>`, `jwtService.verifyAsync(token)`, e faz `request['user'] = payload`. O payload do login deve conter `sub: usuario.co_uuid`.

### Passo 4: aplicar guard + interceptor nos controllers

Por controller (como no projeto de referência):

```ts
@Controller('<recurso>')
@UseGuards(JwtAuthGuard)            // 1º: popula request.user
@UseInterceptors(AuditInterceptor)  // 2º: injeta co_uuid_1 / no_endpoint_modificador no body
export class <Entidade>Controller { ... }
```

Ou globalmente em `app.module.ts` (seguro, pois o interceptor só age se `request.user` existir):

```ts
providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }]
```

### Passo 5: service repassa os campos ao Prisma

Os campos injetados **precisam chegar ao `data`** do Prisma. Duas formas usadas no projeto de referência:

```ts
// a) body inteiro vai para o data (create/update simples)
async atualizar(id: number, dados: any) {
  return this.prisma.tb_<entidade>.update({ where: { co_seq_<entidade>: id }, data: dados });
}

// b) campos explícitos (preferível: evita mass assignment)
async atualizarEmLote(body: { ids: number[]; novoNome: string; co_uuid_1?: string; no_endpoint_modificador?: string }) {
  const { ids, novoNome, co_uuid_1, no_endpoint_modificador } = body;
  return this.prisma.tb_<entidade>.updateMany({
    where: { co_seq_<entidade>: { in: ids } },
    data: { ds_nome: novoNome, co_uuid_1, no_endpoint_modificador },  // SEMPRE repassar os dois campos
  });
}
```

**Regra de ouro:** toda escrita (`create`, `update`, `updateMany`, `upsert`, `$executeRaw`) em tabela auditada deve setar `co_uuid_1` e `no_endpoint_modificador`. Ver Armadilha B para o motivo.

### Passo 6: migration com função + trigger

Gere a migration **sem aplicar**, para poder anexar o SQL do trigger:

```bash
npx prisma migrate dev --create-only --name auditoria_<entidade>
```

Abra o `migration.sql` gerado e, **depois** dos `CREATE TABLE`, acrescente:

```sql
-- Função do trigger (uma por tabela auditada)
CREATE OR REPLACE FUNCTION fc_auditoria_tb_<entidade>()
RETURNS TRIGGER AS $$
BEGIN
    -- Se for UPDATE, fecha a versão vigente no histórico
    IF (TG_OP = 'UPDATE') THEN
        UPDATE th_<entidade>_hist
        SET dh_fim_hist = now()
        WHERE co_seq_<entidade> = OLD.co_seq_<entidade>
        AND dh_fim_hist IS NULL;
    END IF;

    -- INSERT ou UPDATE: cria a nova versão no histórico
    INSERT INTO th_<entidade>_hist (
        co_seq_<entidade>,
        <coluna_negocio_1>,
        <coluna_negocio_2>,
        co_uuid_1,
        no_endpoint_modificador,
        dh_inicio_hist
    ) VALUES (
        NEW.co_seq_<entidade>,
        NEW.<coluna_negocio_1>,
        NEW.<coluna_negocio_2>,
        NEW.co_uuid_1,
        NEW.no_endpoint_modificador,
        now()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Associa o trigger à tabela
CREATE TRIGGER tr_auditoria_tb_<entidade>
AFTER INSERT OR UPDATE ON "tb_<entidade>"
FOR EACH ROW
EXECUTE FUNCTION fc_auditoria_tb_<entidade>();
```

Depois aplique: `npx prisma migrate dev` (dev) ou `npx prisma migrate deploy` (prod).

> O Prisma não modela funções/triggers no `schema.prisma`, mas preserva o SQL da migration e o reexecuta no shadow database, então não há drift. **Nunca** aplique SQL de auditoria manualmente fora de uma migration (no projeto de referência, `add_endpoint.sql` foi aplicado à mão e por isso a migration versionada está desatualizada em relação ao banco).

### Passo 7: endpoint de leitura do histórico (opcional)

```ts
@Get(':id/historico')
verHistorico(@Param('id') id: string) {
  return this.prisma.th_<entidade>_hist.findMany({
    where: { co_seq_<entidade>: Number(id) },
    orderBy: { dh_inicio_hist: 'asc' },
  });
}
```

Consulta "como estava o registro na data X":

```sql
SELECT * FROM th_<entidade>_hist
WHERE co_seq_<entidade> = $1
  AND dh_inicio_hist <= $2
  AND (dh_fim_hist IS NULL OR dh_fim_hist > $2);
```

---

## 4. Adicionar coluna nova em tabela já auditada

Sempre em uma **nova migration** (`--create-only`), três coisas juntas:
1. `schema.prisma`: adicionar a coluna na `tb_` **e** na `th_`.
2. No `migration.sql` gerado, acrescentar o `CREATE OR REPLACE FUNCTION fc_auditoria_tb_<entidade>()` **completo**, com a nova coluna no `INSERT INTO th_..._hist` (`NEW.<nova_coluna>`). Não é preciso recriar o trigger, só a função.
3. Aplicar a migration.

Se esquecer o passo 2, a coluna nova existe no histórico mas fica sempre `NULL`.

---

## 5. Armadilhas conhecidas (LEIA antes de implementar)

### A. `ValidationPipe({ whitelist: true })` x campos injetados
Pipes rodam **depois** dos interceptors. Com `whitelist: true`, se o `@Body()` for tipado com uma **classe DTO**, o pipe **remove** `co_uuid_1` e `no_endpoint_modificador`, porque eles não estão decorados no DTO, e a auditoria grava `NULL`.
No projeto de referência isso só "funciona" porque os bodies são `any` ou `Dto & {...}`. Nesses dois casos o TypeScript emite `Object` como metatype e o `ValidationPipe` **pula a validação inteira**: os decorators de `UpdateManyProdutosDto` **não estão sendo validados**.
**Correção recomendada no projeto alvo:** crie uma classe base e estenda-a nos DTOs de escrita:

```ts
import { IsOptional, IsString } from 'class-validator';
export abstract class AuditavelDto {
  @IsOptional() @IsString() co_uuid_1?: string;
  @IsOptional() @IsString() no_endpoint_modificador?: string;
}
export class UpdateManyProdutosDto extends AuditavelDto { /* ids, novoNome ... */ }
```

e tipe o parâmetro **só com a classe** (`@Body() body: UpdateManyProdutosDto`), sem interseção, para a validação voltar a rodar.

### B. Autoria "herdada" (atribuição errada)
O trigger copia `NEW.co_uuid_1`. Num `UPDATE` que **não** seta essa coluna (rota sem interceptor, job, script, `$executeRaw`, DBA no DBeaver), `NEW.co_uuid_1` mantém o valor **da alteração anterior**, e o histórico atribui a mudança ao usuário errado.
Mitigações (escolha uma):
- Disciplina: sempre setar os dois campos em toda escrita (regra de ouro do Passo 5).
- Endurecer no banco com um trigger `BEFORE UPDATE` que zera os campos quando não foram alterados explicitamente:
  ```sql
  CREATE OR REPLACE FUNCTION fc_limpa_autoria_tb_<entidade>() RETURNS TRIGGER AS $$
  BEGIN
      IF NEW.co_uuid_1 IS NOT DISTINCT FROM OLD.co_uuid_1
         AND NEW.no_endpoint_modificador IS NOT DISTINCT FROM OLD.no_endpoint_modificador THEN
          NEW.co_uuid_1 := NULL;
          NEW.no_endpoint_modificador := NULL;
      END IF;
      RETURN NEW;
  END; $$ LANGUAGE plpgsql;
  CREATE TRIGGER tr_limpa_autoria_tb_<entidade> BEFORE UPDATE ON "tb_<entidade>"
  FOR EACH ROW EXECUTE FUNCTION fc_limpa_autoria_tb_<entidade>();
  ```
  (Limitação: o mesmo usuário alterando duas vezes pela mesma rota também é zerado. Aceitável se `NULL` = "origem desconhecida/repetida"; caso contrário, prefira a disciplina.)

### C. DELETE não é auditado
O trigger cobre só `INSERT OR UPDATE`. O padrão do projeto é **soft delete** via `st_ativo = false` (um `UPDATE`, portanto auditado). Se precisar de delete físico, adicione `OR DELETE` ao trigger e, na função, trate `TG_OP = 'DELETE'` fechando a versão vigente com `OLD` e retornando `OLD`. Mas **o usuário não estará disponível** (não há `NEW`); para isso, faça um update de autoria antes do delete, na mesma transação.

### D. Mass assignment
Passar `data: body` direto ao Prisma (como em `criarProduto`/`atualizarProduto`) permite que o cliente envie qualquer coluna (`dh_criacao`, `st_ativo`...). Prefira DTOs com `whitelist: true` (Armadilha A resolvida) ou montar o `data` explicitamente.

### E. Detalhes de `now()` e de updates "vazios"
- `now()` no Postgres é o horário de **início da transação**: várias alterações da mesma linha numa única transação geram versões com `dh_inicio_hist = dh_fim_hist`. É esperado.
- Um `UPDATE` que não muda nada ainda gera nova versão (inclusive porque `@updatedAt` muda `dh_alteracao`). Se quiser evitar, filtre no trigger comparando só as colunas auditadas, por exemplo `IF TG_OP = 'UPDATE' AND (NEW.ds_nome, NEW.st_ativo) IS NOT DISTINCT FROM (OLD.ds_nome, OLD.st_ativo) THEN RETURN NEW; END IF;` no início da função.
- `@updatedAt` é preenchido pelo **Prisma Client**, não pelo banco; `UPDATE` via SQL puro não atualiza `dh_alteracao`.

### F. Body não-objeto
Se uma rota não-GET receber body vazio, `{...undefined}` resulta em `{}` (ok). Se receber um **array**, o spread o transforma em objeto `{0:...,1:...}`. Rotas que aceitam array no body devem ficar fora do interceptor ou encapsular o array (`{ itens: [...] }`).

---

## 6. Checklist de aceite (para o agente validar)

Para cada tabela auditada:
- [ ] `tb_<entidade>` tem `co_uuid_1`, `no_endpoint_modificador`, `dh_criacao`, `dh_alteracao`.
- [ ] `th_<entidade>_hist` espelha as colunas de negócio + `co_uuid_1`, `no_endpoint_modificador`, `dh_inicio_hist`, `dh_fim_hist`, com índice `(co_seq_<entidade>, dh_fim_hist)`.
- [ ] Função `fc_auditoria_tb_<entidade>` e trigger `tr_auditoria_tb_<entidade>` estão **dentro de uma migration versionada**.
- [ ] O `INSERT` da função lista **todas** as colunas de negócio da `th_`.
- [ ] Controller de escrita tem `JwtAuthGuard` + `AuditInterceptor` (ou o interceptor é global).
- [ ] DTOs de escrita estendem `AuditavelDto` e o `@Body()` é tipado só com a classe.
- [ ] Toda chamada de escrita do Prisma repassa `co_uuid_1` e `no_endpoint_modificador`.

Teste manual (substituir `<TOKEN>`/`<ID>`):
```bash
# 1. login → pegar access_token
curl -X POST localhost:3000/auth/login -H "Content-Type: application/json" -d '{"email":"a@a.com","senha":"123"}'
# 2. criar
curl -X POST localhost:3000/<recurso> -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"ds_nome":"v1"}'
# 3. atualizar
curl -X PUT localhost:3000/<recurso>/<ID> -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"ds_nome":"v2"}'
# 4. histórico
curl localhost:3000/<recurso>/<ID>/historico -H "Authorization: Bearer <TOKEN>"
```
Resultado esperado no passo 4: **2 linhas**; a 1ª (`v1`) com `dh_fim_hist` preenchido, a 2ª (`v2`) com `dh_fim_hist = null`; ambas com `co_uuid_1` = UUID do usuário logado e `no_endpoint_modificador` = URL chamada.
Teste de lote: um `updateMany` em N ids deve gerar N novas linhas no histórico.

---
