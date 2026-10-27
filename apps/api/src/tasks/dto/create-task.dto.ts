import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsIn(['todo', 'in_progress', 'done'])
  status!: string;

  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority!: string;
}
