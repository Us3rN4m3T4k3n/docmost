import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ScreenshotDetectionService } from './screenshot-detection.service';
import { ScreenshotAttemptDto } from './dto/screenshot-attempt.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { User } from '@docmost/db/types/entity.types';

@UseGuards(JwtAuthGuard)
@Controller('security')
export class ScreenshotDetectionController {
  constructor(
    private readonly screenshotDetectionService: ScreenshotDetectionService,
  ) {}

  @HttpCode(HttpStatus.CREATED)
  @Post('screenshot-attempt')
  async logScreenshotAttempt(
    @Body() dto: ScreenshotAttemptDto,
    @AuthUser() user: User,
  ) {
    return this.screenshotDetectionService.logScreenshotAttempt({
      ...dto,
      userId: user.id,
      workspaceId: user.workspaceId,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Get('screenshot-status')
  async getScreenshotStatus(@AuthUser() user: User) {
    const status = await this.screenshotDetectionService.getUserStatus(user.id);

    return {
      success: true,
      status: status || {
        attemptCount: 0,
        status: 'good_standing',
        isSuspended: false,
      },
    };
  }

  @Get('violations')
  @UseGuards(JwtAuthGuard)
  async getViolations(@AuthUser() user: User) {
    if (user.role !== 'admin' && user.role !== 'owner') {
      throw new ForbiddenException();
    }
    return this.screenshotDetectionService.getUsersWithViolations();
  }

  @Post('reinstate/:userId')
  @UseGuards(JwtAuthGuard)
  async reinstateUser(
    @AuthUser() user: User,
    @Param('userId') userId: string,
  ) {
    if (user.role !== 'admin' && user.role !== 'owner') {
      throw new ForbiddenException();
    }
    await this.screenshotDetectionService.resetUserAttempts(userId);
    return { success: true };
  }
}
