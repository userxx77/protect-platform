import { ApiPropertyOptional } from '@nestjs/swagger';
import { FlagLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ServerConfigBodyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{17,20}$/)
  alertChannelId?: string;

  @ApiPropertyOptional({ enum: FlagLevel })
  @IsOptional()
  @IsEnum(FlagLevel)
  alertMinLevel?: FlagLevel;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Matches(/^\d{17,20}$/, { each: true })
  mentionRoleIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  joinHoldEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 40320 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(40320)
  joinHoldDurationMinutes?: number;

  @ApiPropertyOptional({ enum: FlagLevel })
  @IsOptional()
  @IsEnum(FlagLevel)
  joinHoldMinLevel?: FlagLevel;
}

export class UpsertServerConfigDto {
  @IsString()
  @Matches(/^\d{17,20}$/)
  guildId!: string;

  @ValidateNested()
  @Type(() => ServerConfigBodyDto)
  config!: ServerConfigBodyDto;
}
