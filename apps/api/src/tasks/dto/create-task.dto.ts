import { MaxLength } from 'class-validator';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsIn(['todo', 'in_progress', 'done'])
  status!: string;

  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority!: string;

  @IsInt()
  @Min(1)
  projectId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  assigneeId?: number | null;
}
