import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsString, Matches, ValidateNested } from 'class-validator';
import { ServerConfigBodyDto } from './server-config.dto';

/** Bot-only proxy: Discord verified ManageGuild; API logs actor as USER. */
export class BotProxyServerConfigDto {
  @ApiProperty({ description: 'Guild admin Discord snowflake (from interaction.user.id)' })
  @IsString()
  @Matches(/^\d{17,20}$/)
  actorDiscordId!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^\d{17,20}$/)
  guildId!: string;

  @ApiProperty({ type: ServerConfigBodyDto })
  @ValidateNested()
  @Type(() => ServerConfigBodyDto)
  config!: ServerConfigBodyDto;
}
