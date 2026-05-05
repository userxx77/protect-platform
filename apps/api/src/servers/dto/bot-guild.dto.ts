import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, Matches } from 'class-validator';

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
}

export class BotMembersBatchDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @Matches(/^\d{17,20}$/, { each: true })
  discordUserIds!: string[];
}
