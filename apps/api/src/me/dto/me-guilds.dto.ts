import { ApiProperty } from '@nestjs/swagger';
import { IsArray, Matches } from 'class-validator';

export class MeGuildsResolveDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @Matches(/^\d{17,20}$/, { each: true })
  guildIds!: string[];
}
