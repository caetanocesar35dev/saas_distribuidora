import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { hasMinRole } from '../common/decorators/access.decorators';
import {
  PaginationQueryDto,
  paginate,
  pageArgs,
} from '../common/dto/pagination.dto';
import { roundMoney, toCents, fromCents } from '../common/utils/money';
import { lockCashShared } from '../cash-register/cash-lock';
import { PrismaService } from '../prisma/prisma.service';
import { ensureOpenCash } from '../cash-register/cash-auto';
import { Allocation, allocatePayment } from './allocate-payment';
import { addCustomerDebt } from './customer-ledger';
import { Viewer } from './customers.service';
import { CreatePaymentDto } from './dto/customers.dto';

const PAYMENT_SELECT = {
  id: true,
  customerId: true,
  storeId: true,
  store: { select: { name: true } },
  amount: true,
  paymentMethod: true,
  createdAt: true,
  allocations: {
    where: { deletedAt: null },
    select: { storeId: true, amount: true, store: { select: { name: true } } },
  },
} satisfies Prisma.CustomerPaymentSelect;

@Injectable()
export class CustomerPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recebe um pagamento de fiado na loja `storeId` (onde o dinheiro entra). O abatimento pode ir
   * para dívidas de outras lojas da mesma empresa (abatimento cruzado). Tudo numa transação:
   * pagamento, alocações, baixa dos saldos e entrada no caixa da loja que recebeu.
   */
  async pay(
    storeId: string,
    companyId: string,
    customerId: string,
    dto: CreatePaymentDto,
  ) {
    if (dto.paymentMethod === 'CREDIT_STORE') {
      throw new BadRequestException(
        'Forma de pagamento inválida para quitar fiado.',
      );
    }
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!customer)
      throw new NotFoundException('Cliente não encontrado nesta empresa.');

    const amountCents = toCents(dto.amount);

    // Sem caixa aberto, abre um sozinho (decisão do usuário: o caixa não depende de abrir à mão).
    await ensureOpenCash(this.prisma, storeId);
    const paymentId = await this.prisma.$transaction(async (tx) => {
      await lockCashShared(tx, storeId);
      const cash = await tx.cashRegister.findFirst({
        where: { storeId, status: 'OPEN' },
      });
      if (!cash)
        throw new ConflictException(
          'Não há caixa aberto nesta loja para receber o pagamento.',
        );

      const debts = await tx.customerStoreBalance.findMany({
        where: {
          customerId,
          balance: { gt: 0 },
          store: { companyId, deletedAt: null },
        },
        select: { storeId: true, balance: true, updatedAt: true },
      });

      const allocations = dto.allocations
        ? this.validateManualAllocations(dto.allocations, debts, amountCents)
        : this.autoAllocate(debts, dto.amount, storeId);

      const payment = await tx.customerPayment.create({
        data: {
          customerId,
          storeId,
          amount: roundMoney(dto.amount),
          paymentMethod: dto.paymentMethod,
        },
      });
      await tx.customerPaymentAllocation.createMany({
        data: allocations.map((a) => ({
          paymentId: payment.id,
          storeId: a.storeId,
          amount: a.amount,
        })),
      });
      for (const a of allocations) {
        await addCustomerDebt(tx, customerId, a.storeId, -a.amount);
      }
      await tx.cashMovement.create({
        data: {
          cashRegisterId: cash.id,
          type: 'IN',
          amount: roundMoney(dto.amount),
          description: `Pagamento de fiado - Cliente: ${customer.name}`,
        },
      });
      return payment.id;
    });

    return this.prisma.customerPayment.findUniqueOrThrow({
      where: { id: paymentId },
      select: PAYMENT_SELECT,
    });
  }

  /** Histórico de pagamentos do cliente. Funcionário só vê o que foi recebido nas lojas dele. */
  async list(
    companyId: string,
    customerId: string,
    viewer: Viewer,
    query: PaginationQueryDto,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado.');

    const where: Prisma.CustomerPaymentWhereInput = {
      customerId,
      store: { companyId },
      ...(hasMinRole(viewer.role, Role.MANAGER)
        ? {}
        : { storeId: { in: viewer.storeIds } }),
    };
    const [data, total] = await Promise.all([
      this.prisma.customerPayment.findMany({
        where,
        select: PAYMENT_SELECT,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.customerPayment.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  private autoAllocate(
    debts: { storeId: string; balance: number; updatedAt: Date }[],
    amount: number,
    receivingStoreId: string,
  ): Allocation[] {
    if (debts.length === 0)
      throw new BadRequestException('O cliente não tem dívida para quitar.');
    // TODO(decisão-produto): não há saldo credor: pagamento maior que a dívida total é recusado (400).
    const { allocations, unallocated } = allocatePayment(
      debts,
      amount,
      receivingStoreId,
    );
    if (unallocated > 0) {
      const total = fromCents(
        debts.reduce((sum, d) => sum + toCents(d.balance), 0),
      );
      throw new BadRequestException(
        `O valor (R$ ${amount.toFixed(2)}) é maior que a dívida total do cliente (R$ ${total.toFixed(2)}).`,
      );
    }
    return allocations;
  }

  private validateManualAllocations(
    allocations: { storeId: string; amount: number }[],
    debts: { storeId: string; balance: number }[],
    amountCents: number,
  ): Allocation[] {
    const stores = allocations.map((a) => a.storeId);
    if (new Set(stores).size !== stores.length) {
      throw new BadRequestException(
        'Cada loja só pode aparecer uma vez nas alocações.',
      );
    }
    const sum = allocations.reduce((acc, a) => acc + toCents(a.amount), 0);
    if (sum !== amountCents) {
      throw new BadRequestException(
        'A soma das alocações precisa ser igual ao valor do pagamento.',
      );
    }
    const owed = new Map(debts.map((d) => [d.storeId, toCents(d.balance)]));
    for (const a of allocations) {
      const debt = owed.get(a.storeId);
      if (debt === undefined) {
        throw new BadRequestException(
          'O cliente não tem dívida em uma das lojas informadas.',
        );
      }
      if (toCents(a.amount) > debt) {
        throw new BadRequestException(
          'Uma das alocações é maior que a dívida do cliente na loja.',
        );
      }
    }
    return allocations.map((a) => ({
      storeId: a.storeId,
      amount: roundMoney(a.amount),
    }));
  }
}
