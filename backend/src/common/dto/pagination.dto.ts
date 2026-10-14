import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; totalItems: number; totalPages: number };
}

export function paginate<T>(
  data: T[],
  totalItems: number,
  page: number,
  limit: number,
): Paginated<T> {
  return {
    data,
    meta: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  };
}

export function pageArgs(q: { page: number; limit: number }) {
  return { skip: (q.page - 1) * q.limit, take: q.limit };
}
