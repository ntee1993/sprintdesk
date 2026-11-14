import { MaxLength } from 'class-validator';
import { IsEmail, IsIn } from 'class-validator';

export class AddProjectMemberDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsIn(['EDITOR', 'VIEWER'])
  role!: 'EDITOR' | 'VIEWER';
}
