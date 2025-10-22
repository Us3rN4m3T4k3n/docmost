import { IsString, IsOptional } from 'class-validator';

export class ContentProtectionAttemptDto {
  @IsString()
  attemptType: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsString()
  timestamp: string;

  @IsString()
  userAgent: string;
}

