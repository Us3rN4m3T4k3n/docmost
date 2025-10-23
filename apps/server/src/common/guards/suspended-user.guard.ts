import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';

@Injectable()
export class SuspendedUserGuard implements CanActivate {
  private readonly logger = new Logger(SuspendedUserGuard.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.id) {
      // No user or no ID, let other guards handle authentication
      return true;
    }

    // Check if user is suspended
    const dbUser = await this.db
      .selectFrom('users')
      .select(['suspendedAt', 'suspensionReason'])
      .where('id', '=', user.id)
      .executeTakeFirst();

    if (dbUser?.suspendedAt) {
      this.logger.warn(`Blocked suspended user ${user.id} from accessing resource`);
      
      throw new ForbiddenException({
        message: 'Account Suspended',
        reason: dbUser.suspensionReason || 'Your account has been suspended due to policy violations',
        suspendedAt: dbUser.suspendedAt,
        statusCode: 403,
        error: 'AccountSuspended',
      });
    }

    return true;
  }
}

