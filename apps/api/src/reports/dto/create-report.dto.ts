import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FlagLevel } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateReportDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d{17,20}$/)
  reporterDiscordId!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\d{17,20}$/)
  targetDiscordId!: string;

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

  @ApiPropertyOptional({ enum: FlagLevel, description: 'Reporter-indicated severity (required for bot and guild/community reports).' })
  @IsOptional()
  @IsEnum(FlagLevel)
  allegedFlagLevel?: FlagLevel;
}
