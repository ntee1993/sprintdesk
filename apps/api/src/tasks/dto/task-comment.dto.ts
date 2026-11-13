import { IsString, Matches, MaxLength } from 'class-validator';

export class TaskCommentDto {
  @IsString()
  @Matches(/\S/, { message: 'content must not be empty' })
  @MaxLength(2000)
  content!: string;
}
