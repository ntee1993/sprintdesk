import { IsEmail, IsIn } from 'class-validator';

export class AddProjectMemberDto {
  @IsEmail()
  email!: string;

  @IsIn(['EDITOR', 'VIEWER'])
  role!: 'EDITOR' | 'VIEWER';
}
