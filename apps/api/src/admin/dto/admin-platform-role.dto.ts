import { IsIn } from 'class-validator';

export class AdminPlatformRoleBodyDto {
  @IsIn(['CHECKER', 'USER'])
  role!: 'CHECKER' | 'USER';
}
