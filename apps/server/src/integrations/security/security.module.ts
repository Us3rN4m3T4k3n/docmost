import { Module } from '@nestjs/common';
import { RobotsTxtController } from './robots.txt.controller';
import { VersionController } from './version.controller';
import { VersionService } from './version.service';
import { ContentProtectionController } from './content-protection.controller';
import { ContentProtectionService } from './content-protection.service';
import { ScreenshotDetectionController } from './screenshot-detection.controller';
import { ScreenshotDetectionService } from './screenshot-detection.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [
    RobotsTxtController,
    VersionController,
    ContentProtectionController,
    ScreenshotDetectionController,
  ],
  providers: [VersionService, ContentProtectionService, ScreenshotDetectionService],
  exports: [ContentProtectionService, ScreenshotDetectionService],
})
export class SecurityModule {}
