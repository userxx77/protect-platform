import { ApiPropertyOptional } from '@nestjs/swagger';
import { FlagLevel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
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
}

export class UpsertServerConfigDto {
  @IsString()
  @Matches(/^\d{17,20}$/)
  guildId!: string;

  @ValidateNested()
  @Type(() => ServerConfigBodyDto)
  config!: ServerConfigBodyDto;
}
