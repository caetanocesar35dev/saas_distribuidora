/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging, @typescript-eslint/no-empty-object-type --
   A mesclagem classe + interface é de propósito: a classe é o token de injeção do Nest e a interface
   dá a ela a tipagem completa do PrismaClient estendido (auditoria + soft delete). */
import { ExtendedPrismaClient } from './prisma.extension';

/** Token de injeção do PrismaClient estendido. */
export abstract class PrismaService {}
export interface PrismaService extends ExtendedPrismaClient {}
