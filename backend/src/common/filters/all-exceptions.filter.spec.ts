import {
  ArgumentsHost,
  ConflictException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { AuditViolationError } from '../../prisma/prisma.extension';
import { AllExceptionsFilter } from './all-exceptions.filter';

function run(exception: unknown) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return {
    status: status.mock.calls[0][0] as number,
    body: json.mock.calls[0][0] as Record<string, unknown>,
  };
}

describe('AllExceptionsFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('mantém o status e o corpo das exceções HTTP do Nest', () => {
    const r = run(new ConflictException('já existe'));
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ message: 'já existe' });
  });

  it('mantém o corpo customizado (ex.: 402 com code e reason)', () => {
    const r = run(
      new HttpException(
        { statusCode: 402, code: 'SUBSCRIPTION_READ_ONLY', reason: 'PAST_DUE' },
        402,
      ),
    );
    expect(r.status).toBe(402);
    expect(r.body).toMatchObject({
      code: 'SUBSCRIPTION_READ_ONLY',
      reason: 'PAST_DUE',
    });
  });

  it('texto puro vira { statusCode, message }', () => {
    const r = run(new HttpException('texto', 418));
    expect(r).toEqual({
      status: 418,
      body: { statusCode: 418, message: 'texto' },
    });
  });

  it.each([
    ['P2002', 409, /Já existe um registro/],
    ['P2003', 409, /relacionado a outros dados/],
    ['P2025', 404, /não encontrado/],
  ])(
    'erro do Prisma %s vira %i com mensagem amigável',
    (code, expectedStatus, message) => {
      const r = run(
        Object.assign(new Error('mensagem SQL crua com tb_users'), { code }),
      );
      expect(r.status).toBe(expectedStatus);
      expect(String(r.body.message)).toMatch(message);
      expect(JSON.stringify(r.body)).not.toContain('tb_users'); // nunca vaza SQL
    },
  );

  it('P2002 informa os campos em conflito', () => {
    const r = run(
      Object.assign(new Error('x'), {
        code: 'P2002',
        meta: { target: ['email'] },
      }),
    );
    expect(r.body).toMatchObject({ fields: ['email'] });
  });

  it('trigger de DELETE físico vira 409 claro', () => {
    const r = run(new Error('DELETE físico não permitido em "tb_users".'));
    expect(r.status).toBe(409);
    expect(String(r.body.message)).toMatch(/Exclusão física/);
  });

  it('erro desconhecido e violação de auditoria viram 500 genérico, sem vazar a causa', () => {
    for (const error of [
      new Error('senha do banco é 123'),
      new AuditViolationError('escrita sem autor'),
      'string solta',
    ]) {
      const r = run(error);
      expect(r.status).toBe(500);
      expect(r.body).toEqual({
        statusCode: 500,
        message: 'Erro interno do servidor.',
      });
    }
  });

  it('código que parece do Prisma mas é desconhecido cai no 500', () => {
    expect(run(Object.assign(new Error('x'), { code: 'P9999' })).status).toBe(
      500,
    );
    expect(
      run(Object.assign(new Error('x'), { code: 'ECONNRESET' })).status,
    ).toBe(500);
  });
});
