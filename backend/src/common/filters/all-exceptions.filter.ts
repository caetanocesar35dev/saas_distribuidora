import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AuditViolationError } from '../../prisma/prisma.extension';

interface PrismaLikeError {
  code: string;
  message: string;
  meta?: { target?: unknown; modelName?: string; field_name?: string };
}

function isPrismaKnownError(error: unknown): error is PrismaLikeError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as PrismaLikeError).code === 'string' &&
    /^P\d{4}$/.test((error as PrismaLikeError).code)
  );
}

/**
 * Converte erros do Prisma/banco em respostas HTTP claras e nunca vaza mensagem SQL crua.
 *  - P2002 (único violado) -> 409
 *  - P2003 (chave estrangeira) -> 409
 *  - P2025 (não encontrado) -> 404
 *  - trigger de DELETE físico -> 409
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      return response
        .status(status)
        .json(
          typeof body === 'string'
            ? { statusCode: status, message: body }
            : body,
        );
    }

    if (isPrismaKnownError(exception)) {
      switch (exception.code) {
        case 'P2002': {
          const target = exception.meta?.target;
          return response.status(HttpStatus.CONFLICT).json({
            statusCode: 409,
            message: 'Já existe um registro com esses dados.',
            ...(Array.isArray(target) ? { fields: target } : {}),
          });
        }
        case 'P2003':
          return response.status(HttpStatus.CONFLICT).json({
            statusCode: 409,
            message:
              'Operação inválida: o registro está relacionado a outros dados.',
          });
        case 'P2025':
          return response.status(HttpStatus.NOT_FOUND).json({
            statusCode: 404,
            message: 'Registro não encontrado.',
          });
      }
    }

    const message =
      exception instanceof Error ? exception.message : String(exception);
    if (message.includes('DELETE físico não permitido')) {
      return response.status(HttpStatus.CONFLICT).json({
        statusCode: 409,
        message:
          'Exclusão física não é permitida. O registro deve ser desativado.',
      });
    }

    if (exception instanceof AuditViolationError) {
      this.logger.error(`Violação de auditoria: ${message}`);
    } else {
      this.logger.error(
        exception instanceof Error ? (exception.stack ?? message) : message,
      );
    }
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: 'Erro interno do servidor.',
    });
  }
}
