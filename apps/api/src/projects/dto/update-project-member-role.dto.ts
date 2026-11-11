import { IsIn } from 'class-validator';

export class UpdateProjectMemberRoleDto {
  @IsIn(['EDITOR', 'VIEWER'])
  role!: 'EDITOR' | 'VIEWER';
}
