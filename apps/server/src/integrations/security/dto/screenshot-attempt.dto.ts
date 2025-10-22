import { IsString, IsOptional } from 'class-validator';

export class ScreenshotAttemptDto {
  @IsString()
  method: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsString()
  timestamp: string;

  @IsString()
  userAgent: string;
}

