import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AdminPatchFlagDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  weight?: number;
}
