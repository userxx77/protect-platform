import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const SUPPORT_TICKET_STATUSES = [
  'OPEN',
  'NEEDS_EVIDENCE',
  'EVIDENCE_SUBMITTED',
  'UNDER_REVIEW',
  'RESOLVED',
  'REJECTED',
] as const;

export type SupportTicketStatusDto = (typeof SUPPORT_TICKET_STATUSES)[number];

export class AdminPatchTicketDto {
  @IsOptional()
  @IsIn([...SUPPORT_TICKET_STATUSES])
  status?: SupportTicketStatusDto;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  adminNote?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  userMessage?: string | null;
}
