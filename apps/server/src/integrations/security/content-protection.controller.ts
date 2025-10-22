import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ContentProtectionService } from './content-protection.service';
import { ContentProtectionAttemptDto } from './dto/content-protection-attempt.dto';

@UseGuards(JwtAuthGuard)
@Controller('security')
export class ContentProtectionController {
  constructor(
    private readonly contentProtectionService: ContentProtectionService,
  ) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('protection-attempt')
  async logProtectionAttempt(
    @Body() dto: ContentProtectionAttemptDto,
    @Req() req,
  ) {
    const userId = req.user?.userId;
    const workspaceId = req.raw?.workspaceId;
    const ipAddress = req.ip || req.raw?.ip;

    return this.contentProtectionService.logAttempt({
      ...dto,
      userId,
      workspaceId,
      ipAddress,
    });
  }
}

