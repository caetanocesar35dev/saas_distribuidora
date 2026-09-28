import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) { }

  private generateBarcode(): string {
    let code = '';
    for (let i = 0; i < 13; i++) {
      code += Math.floor(Math.random() * 10).toString();
    }
    return code;
  }

  async findAll() {
    return this.prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: { bottleType: true }
    });
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { bottleType: true }
    });
    if (!product) {
      throw new NotFoundException('Produto não encontrado');
    }
    return product;
  }

  async findByCode(code: string) {
    const product = await this.prisma.product.findUnique({
      where: { code },
    });
    if (!product) {
      throw new NotFoundException(`Produto com o código ${code} não encontrado`);
    }
    return product;
  }

  async create(data: CreateProductDto & { modifierId?: number, modifiedEndpoint?: string }) {
    let code = '';
    let isUnique = false;

    while (!isUnique) {
      code = this.generateBarcode();
      const existing = await this.prisma.product.findUnique({ where: { code } });
      if (!existing) {
        isUnique = true;
      }
    }

    return this.prisma.product.create({
      data: {
        code,
        name: data.name,
        price: Number(data.price),
        costPrice: Number(data.costPrice),
        stock: data.stock !== undefined ? Number(data.stock) : 0,
        packQuantity: data.packQuantity !== undefined ? Number(data.packQuantity) : 1,
        bottleTypeId: data.bottleTypeId ? Number(data.bottleTypeId) : null,
        modifierId: data.modifierId,
        modifiedEndpoint: data.modifiedEndpoint,
      },
    });
  }

  async update(id: number, data: UpdateProductDto & { modifierId?: number, modifiedEndpoint?: string }) {
    await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: {
        ...data,
        price: data.price !== undefined ? Number(data.price) : undefined,
        costPrice: data.costPrice !== undefined ? Number(data.costPrice) : undefined,
        stock: data.stock !== undefined ? Number(data.stock) : undefined,
        packQuantity: data.packQuantity !== undefined ? Number(data.packQuantity) : undefined,
        bottleTypeId: data.bottleTypeId !== undefined ? (data.bottleTypeId ? Number(data.bottleTypeId) : null) : undefined,
        modifierId: data.modifierId,
        modifiedEndpoint: data.modifiedEndpoint,
      },
    });
  }

  async addStock(id: number, quantity: number, modifierId?: number, modifiedEndpoint?: string) {
    if (quantity <= 0) {
      throw new BadRequestException('A quantidade de entrada deve ser maior que zero');
    }

    const product = await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: {
        stock: product.stock + Math.floor(quantity),
        modifierId,
        modifiedEndpoint,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    try {
      return await this.prisma.product.delete({
        where: { id },
      });
    } catch (e) {
      throw new ConflictException('Não é possível excluir um produto que possui histórico de vendas');
    }
  }
}
