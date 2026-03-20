import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ContentProtectionService } from './content-protection.service';
import { ContentProtectionAttemptDto } from './dto/content-protection-attempt.dto';
import { AuthUser } from '@/common/decorators/auth-user.decorator';
import { User } from '@docmost/db/types/entity.types';

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
    @AuthUser() user: User,
  ) {
    return this.contentProtectionService.logAttempt({
      ...dto,
      userId: user.id,
      workspaceId: user.workspaceId,
    });
  }
}
