import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ScreenshotDetectionService } from './screenshot-detection.service';
import { ScreenshotAttemptDto } from './dto/screenshot-attempt.dto';

@UseGuards(JwtAuthGuard)
@Controller('security')
export class ScreenshotDetectionController {
  constructor(
    private readonly screenshotDetectionService: ScreenshotDetectionService,
  ) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('screenshot-attempt')
  async logScreenshotAttempt(@Body() dto: ScreenshotAttemptDto, @Req() req) {
    const userId = req.user?.userId;
    const workspaceId = req.raw?.workspaceId;
    const ipAddress = req.ip || req.raw?.ip;

    return this.screenshotDetectionService.logScreenshotAttempt({
      ...dto,
      userId,
      workspaceId,
      ipAddress,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Get('screenshot-status')
  async getScreenshotStatus(@Req() req) {
    const userId = req.user?.userId;
    const status = await this.screenshotDetectionService.getUserStatus(userId);

    return {
      success: true,
      status: status || {
        attemptCount: 0,
        status: 'good_standing',
        isSuspended: false,
      },
    };
  }
}

