import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { UserRepo } from '@docmost/db/repos/user/user.repo';

export interface ScreenshotAttemptLog {
  method: string;
  details?: string;
  timestamp: string;
  userAgent: string;
  userId?: string;
  workspaceId?: string;
  ipAddress?: string;
}

export interface UserScreenshotStatus {
  userId: string;
  attemptCount: number;
  lastAttempt: Date;
  status: 'good_standing' | 'warning' | 'final_warning' | 'suspended' | 'banned';
  isSuspended: boolean;
}

@Injectable()
export class ScreenshotDetectionService {
  private readonly logger = new Logger(ScreenshotDetectionService.name);
  
  // In-memory storage for now (replace with database in production)
  private userAttempts = new Map<string, UserScreenshotStatus>();

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly userRepo: UserRepo,
  ) {}

  /**
   * Log screenshot attempt and return updated status
   */
  async logScreenshotAttempt(attempt: ScreenshotAttemptLog): Promise<{
    success: boolean;
    attemptCount: number;
    status: string;
    isSuspended: boolean;
    message: string;
  }> {
    const userId = attempt.userId;

    // Log the attempt
    this.logger.warn(
      `Screenshot Attempt - User: ${userId}, ` +
        `Method: ${attempt.method}, ` +
        `Details: ${attempt.details || 'N/A'}, ` +
        `IP: ${attempt.ipAddress}, ` +
        `Time: ${attempt.timestamp}`,
    );

    // Get or create user status
    let userStatus = this.userAttempts.get(userId);
    if (!userStatus) {
      userStatus = {
        userId,
        attemptCount: 0,
        lastAttempt: new Date(),
        status: 'good_standing',
        isSuspended: false,
      };
    }

    // Increment attempt count
    userStatus.attemptCount++;
    userStatus.lastAttempt = new Date();

    // Update status based on attempt count
    if (userStatus.attemptCount === 1) {
      userStatus.status = 'warning';
    } else if (userStatus.attemptCount === 2) {
      userStatus.status = 'final_warning';
      // Notify admins of second violation
      await this.notifyAdminsOfViolation(userId, userStatus.attemptCount, attempt);
    } else if (userStatus.attemptCount >= 3) {
      userStatus.status = 'suspended';
      userStatus.isSuspended = true;
      // Suspend user account
      await this.suspendUserAccount(userId, attempt);
      // Notify admins immediately
      await this.notifyAdminsOfSuspension(userId, userStatus.attemptCount, attempt);
    }

    // Store updated status
    this.userAttempts.set(userId, userStatus);

    // TODO: Persist to database
    /*
    await this.db.screenshotAttempts.insert({
      userId,
      workspaceId: attempt.workspaceId,
      method: attempt.method,
      details: attempt.details,
      userAgent: attempt.userAgent,
      ipAddress: attempt.ipAddress,
      timestamp: new Date(attempt.timestamp),
      attemptNumber: userStatus.attemptCount,
      status: userStatus.status,
    });

    await this.db.users.update(userId, {
      screenshotAttempts: userStatus.attemptCount,
      accountStatus: userStatus.status,
      isSuspended: userStatus.isSuspended,
    });
    */

    return {
      success: true,
      attemptCount: userStatus.attemptCount,
      status: userStatus.status,
      isSuspended: userStatus.isSuspended,
      message: this.getMessageForStatus(userStatus),
    };
  }

  /**
   * Get user's current screenshot attempt status
   */
  async getUserStatus(userId: string): Promise<UserScreenshotStatus | null> {
    const status = this.userAttempts.get(userId);
    
    // TODO: Fetch from database in production
    /*
    const dbStatus = await this.db.users.findOne(userId);
    if (dbStatus) {
      return {
        userId,
        attemptCount: dbStatus.screenshotAttempts || 0,
        lastAttempt: dbStatus.lastScreenshotAttempt,
        status: dbStatus.accountStatus,
        isSuspended: dbStatus.isSuspended,
      };
    }
    */
    
    return status || null;
  }

  /**
   * Check if user is suspended
   */
  async isUserSuspended(userId: string): Promise<boolean> {
    const status = await this.getUserStatus(userId);
    return status?.isSuspended || false;
  }

  /**
   * Suspend user account
   */
  private async suspendUserAccount(userId: string, attempt: ScreenshotAttemptLog) {
    this.logger.error(
      `🚫 SUSPENDING USER ACCOUNT: ${userId} - ` +
      `Third screenshot violation detected`,
    );

    try {
      // Suspend user in database
      await this.db
        .updateTable('users')
        .set({
          suspendedAt: new Date(),
          suspensionReason: 'Repeated screenshot violations - Automated suspension after 3 attempts',
          updatedAt: new Date(),
        })
        .where('id', '=', userId)
        .execute();

      this.logger.log(`✅ User ${userId} successfully suspended in database`);

      // TODO: Implement additional actions
      // - Revoke all active sessions
      // - Send suspension email
      // - Notify admins
    } catch (error) {
      this.logger.error(`Failed to suspend user ${userId} in database:`, error);
      throw error;
    }
  }

  /**
   * Notify workspace admins of violation
   */
  private async notifyAdminsOfViolation(
    userId: string,
    attemptCount: number,
    attempt: ScreenshotAttemptLog,
  ) {
    this.logger.warn(
      `📧 Notifying admins: User ${userId} has ${attemptCount} screenshot violations`,
    );

    // TODO: Implement admin notification
    /*
    const admins = await this.db.users.find({
      workspaceId: attempt.workspaceId,
      role: { $in: ['owner', 'admin'] },
    });

    for (const admin of admins) {
      await this.mailService.sendEmail({
        to: admin.email,
        subject: `Security Alert: Screenshot Violation - User ${userId}`,
        template: 'admin-violation-alert',
        data: {
          userId,
          attemptCount,
          method: attempt.method,
          timestamp: attempt.timestamp,
          ipAddress: attempt.ipAddress,
          userAgent: attempt.userAgent,
          severity: attemptCount === 2 ? 'final_warning' : 'warning',
        },
      });
    }

    // Create admin notification in app
    await this.notificationService.create({
      workspaceId: attempt.workspaceId,
      type: 'security_alert',
      severity: 'high',
      title: 'Screenshot Violation Detected',
      message: `User ${userId} has ${attemptCount} screenshot violations`,
      actionUrl: `/settings/members/${userId}`,
      metadata: attempt,
    });
    */
  }

  /**
   * Notify admins of account suspension
   */
  private async notifyAdminsOfSuspension(
    userId: string,
    attemptCount: number,
    attempt: ScreenshotAttemptLog,
  ) {
    this.logger.error(
      `🚨 URGENT: Notifying admins of account suspension - User ${userId}`,
    );

    // TODO: Implement urgent admin notification
    /*
    const admins = await this.db.users.find({
      workspaceId: attempt.workspaceId,
      role: { $in: ['owner', 'admin'] },
    });

    for (const admin of admins) {
      // Send email with high priority
      await this.mailService.sendEmail({
        to: admin.email,
        subject: `🚫 URGENT: Account Suspended - Copyright Violation`,
        priority: 'high',
        template: 'admin-suspension-alert',
        data: {
          userId,
          attemptCount,
          method: attempt.method,
          timestamp: attempt.timestamp,
          ipAddress: attempt.ipAddress,
          suspensionReason: 'Repeated screenshot violations (3+ attempts)',
          actionRequired: true,
        },
      });

      // Create urgent in-app notification
      await this.notificationService.create({
        workspaceId: attempt.workspaceId,
        type: 'security_alert',
        severity: 'critical',
        title: '🚫 Account Suspended - Copyright Violation',
        message: `User ${userId} has been automatically suspended after ${attemptCount} screenshot violations`,
        actionUrl: `/settings/members/${userId}`,
        requiresAction: true,
        metadata: attempt,
      });
    }

    // Log to security audit log
    await this.auditService.log({
      type: 'account_suspension',
      userId,
      workspaceId: attempt.workspaceId,
      reason: 'automated_screenshot_violations',
      attemptCount,
      metadata: attempt,
    });
    */
  }

  /**
   * Get appropriate message for user status
   */
  private getMessageForStatus(status: UserScreenshotStatus): string {
    switch (status.status) {
      case 'warning':
        return 'First warning: Screenshot attempt detected and logged.';
      case 'final_warning':
        return 'Final warning: This is your second violation. One more will result in suspension.';
      case 'suspended':
        return 'Account suspended: Your account has been suspended due to repeated violations.';
      case 'banned':
        return 'Account banned: Your account has been permanently banned.';
      default:
        return 'Account in good standing.';
    }
  }

  /**
   * Reset user's screenshot attempt count (admin action)
   */
  async resetUserAttempts(userId: string, adminId: string) {
    this.logger.log(`Admin ${adminId} reset screenshot attempts for user ${userId}`);
    
    this.userAttempts.delete(userId);

    // TODO: Update database
    /*
    await this.db.users.update(userId, {
      screenshotAttempts: 0,
      accountStatus: 'good_standing',
      isSuspended: false,
      lastResetBy: adminId,
      lastResetAt: new Date(),
    });
    */

    return { success: true, message: 'User attempts reset successfully' };
  }

  /**
   * Get all users with violations (for admin dashboard)
   */
  async getUsersWithViolations(workspaceId: string) {
    // TODO: Query database
    /*
    return await this.db.users.find({
      workspaceId,
      screenshotAttempts: { $gt: 0 },
    }).sort({ screenshotAttempts: -1 });
    */

    // For now, return in-memory data
    const violations = [];
    for (const [userId, status] of this.userAttempts.entries()) {
      violations.push(status);
    }
    return violations;
  }
}

