import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListTasksQueryDto {
  @IsIn(['todo', 'in_progress', 'done'])
  @IsOptional()
  status?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(['id', 'title'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: string;
}
