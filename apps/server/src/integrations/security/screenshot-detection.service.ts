import { Injectable, Logger } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { sql } from 'kysely';

export interface ScreenshotAttemptLog {
  method: string;
  details?: string;
  timestamp?: string;
  userAgent?: string;
  userId?: string;
  workspaceId?: string;
  ipAddress?: string;
}

@Injectable()
export class ScreenshotDetectionService {
  private readonly logger = new Logger(ScreenshotDetectionService.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
    private readonly userRepo: UserRepo,
  ) {}

  /**
   * Log screenshot attempt and return updated status.
   * Persists to screenshot_attempts table and suspends user on 3rd attempt.
   */
  async logScreenshotAttempt(attempt: ScreenshotAttemptLog): Promise<{
    success: boolean;
    attemptCount: number;
    status: string;
    isSuspended: boolean;
    message: string;
  }> {
    const userId = attempt.userId;

    this.logger.warn(
      `Screenshot Attempt - User: ${userId}, ` +
        `Method: ${attempt.method}, ` +
        `Details: ${attempt.details || 'N/A'}, ` +
        `IP: ${attempt.ipAddress}, ` +
        `Time: ${attempt.timestamp || new Date().toISOString()}`,
    );

    // Query current attempt count
    const countResult = await this.db
      .selectFrom('screenshotAttempts')
      .select(sql<string>`count(*)`.as('count'))
      .where('userId', '=', userId)
      .executeTakeFirst();

    const currentCount = parseInt((countResult?.count as string) || '0', 10);
    const newAttemptNumber = currentCount + 1;

    // Insert new attempt row
    await this.db
      .insertInto('screenshotAttempts')
      .values({
        userId,
        workspaceId: attempt.workspaceId || '',
        method: attempt.method,
        userAgent: attempt.userAgent || null,
        ipAddress: attempt.ipAddress || null,
        attemptNumber: newAttemptNumber,
      })
      .execute();

    // Determine status
    let status: string;
    let isSuspended = false;

    if (newAttemptNumber === 1) {
      status = 'warning';
    } else if (newAttemptNumber === 2) {
      status = 'final_warning';
    } else {
      status = 'suspended';
      isSuspended = true;
      await this.suspendUserAccount(userId);
    }

    return {
      success: true,
      attemptCount: newAttemptNumber,
      status,
      isSuspended,
      message: this.getMessageForStatus(status),
    };
  }

  /**
   * Get user's current screenshot attempt status from database.
   */
  async getUserStatus(
    userId: string,
  ): Promise<{ attemptCount: number; suspended: boolean } | null> {
    const countResult = await this.db
      .selectFrom('screenshotAttempts')
      .select(sql<string>`count(*)`.as('count'))
      .where('userId', '=', userId)
      .executeTakeFirst();

    const attemptCount = parseInt((countResult?.count as string) || '0', 10);

    // Query the user's suspension status directly
    const userRow = await this.db
      .selectFrom('users')
      .select(['suspendedAt'])
      .where('id', '=', userId)
      .executeTakeFirst();

    const suspended = userRow?.suspendedAt != null;

    return { attemptCount, suspended };
  }

  /**
   * Suspend user account by setting suspendedAt.
   */
  async suspendUserAccount(userId: string): Promise<void> {
    this.logger.error(
      `Suspending user account: ${userId} - Third screenshot violation detected`,
    );

    await this.db
      .updateTable('users')
      .set({
        suspendedAt: new Date(),
        suspensionReason: 'screenshot_violation',
        updatedAt: new Date(),
      })
      .where('id', '=', userId)
      .execute();

    this.logger.log(`User ${userId} successfully suspended in database`);
  }

  /**
   * Reset user's screenshot attempts and clear suspension (admin action).
   */
  async resetUserAttempts(userId: string): Promise<void> {
    this.logger.log(`Resetting screenshot attempts for user ${userId}`);

    await this.db
      .deleteFrom('screenshotAttempts')
      .where('userId', '=', userId)
      .execute();

    await this.db
      .updateTable('users')
      .set({ suspendedAt: null, suspensionReason: null, updatedAt: new Date() })
      .where('id', '=', userId)
      .execute();
  }

  /**
   * Get all users with screenshot violations (for admin dashboard).
   */
  async getUsersWithViolations(): Promise<
    Array<{
      userId: string;
      email: string;
      attemptCount: number;
      lastAttempt: Date | null;
      suspendedAt: Date | null;
    }>
  > {
    const rows = await this.db
      .selectFrom('screenshotAttempts')
      .innerJoin('users', 'users.id', 'screenshotAttempts.userId')
      .select([
        'screenshotAttempts.userId',
        'users.email',
        sql<string>`count(screenshot_attempts.id)`.as('attemptCount'),
        sql<Date>`max(screenshot_attempts.created_at)`.as('lastAttempt'),
        'users.suspendedAt',
      ])
      .groupBy(['screenshotAttempts.userId', 'users.email', 'users.suspendedAt'])
      .orderBy(sql`count(screenshot_attempts.id)`, 'desc')
      .execute();

    return rows.map((row) => ({
      userId: row.userId,
      email: row.email,
      attemptCount: parseInt(row.attemptCount as unknown as string, 10),
      lastAttempt: row.lastAttempt || null,
      suspendedAt: row.suspendedAt || null,
    }));
  }

  /**
   * Check if user is suspended
   */
  async isUserSuspended(userId: string): Promise<boolean> {
    const status = await this.getUserStatus(userId);
    return status?.suspended || false;
  }

  /**
   * Get appropriate message for status string
   */
  private getMessageForStatus(status: string): string {
    switch (status) {
      case 'warning':
        return 'First warning: Screenshot attempt detected and logged.';
      case 'final_warning':
        return 'Final warning: This is your second violation. One more will result in suspension.';
      case 'suspended':
        return 'Account suspended: Your account has been suspended due to repeated violations.';
      default:
        return 'Account in good standing.';
    }
  }
}
