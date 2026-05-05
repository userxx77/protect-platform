import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateFlagDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d{17,20}$/)
  targetDiscordId!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\d{17,20}$/)
  actorDiscordId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{17,20}$/)
  guildId?: string;

  /** Only dashboard JWT users with ADMIN role may set this */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  adminOverride?: boolean;
}
