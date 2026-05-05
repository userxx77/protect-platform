import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { LicenseStatus } from '@prisma/client';

export class UpsertEntitlementBodyDto {
  @ApiProperty({ enum: LicenseStatus })
  @IsEnum(LicenseStatus)
  status!: LicenseStatus;

  @ApiProperty()
  @IsString()
  validFrom!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  validUntil?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  planCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stripeCustomerId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stripeSubscriptionId?: string | null;
}
