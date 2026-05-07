import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

export class BotGuildLifecycleDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d{17,20}$/)
  guildId!: string;

  @ApiProperty({ enum: ['join', 'leave'] })
  @IsString()
  event!: 'join' | 'leave';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  discordName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  iconHash?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  approximateMemberCount?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{17,20}$/)
  ownerDiscordId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vanityUrlCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  premiumTier?: number | null;
}

/** Bot-only: refresh Server row metadata from live Guild (no lifecycle / entitlement). */
export class BotGuildSnapshotDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d{17,20}$/)
  guildId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  discordName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  iconHash?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  approximateMemberCount?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d{17,20}$/)
  ownerDiscordId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  vanityUrlCode?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  premiumTier?: number | null;
}

export class GuildMemberBatchItemDto {
  @ApiProperty()
  @IsString()
  @Matches(/^\d{17,20}$/)
  discordUserId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  username?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  globalName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarHash?: string | null;
}

export class BotMembersBatchDto {
  @ApiProperty({ type: [GuildMemberBatchItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuildMemberBatchItemDto)
  members!: GuildMemberBatchItemDto[];
}

export class BotGuildElevationScanDto {
  @ApiProperty({ type: [String], description: 'Discord user snowflakes present in the guild' })
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @Matches(/^\d{17,20}$/, { each: true })
  discordIds!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alertMinLevel?: string;
}
