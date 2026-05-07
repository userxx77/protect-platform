import { ApiProperty } from '@nestjs/swagger';
import { flagActionLevels } from '@protect/shared';
import { IsIn } from 'class-validator';

const levels = [...flagActionLevels] as [string, ...string[]];

export class ApproveReportDto {
  @ApiProperty({ enum: flagActionLevels })
  @IsIn(levels)
  severity!: (typeof flagActionLevels)[number];
}
