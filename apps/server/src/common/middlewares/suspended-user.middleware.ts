import { Injectable, NestMiddleware, ForbiddenException, Logger } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';

@Injectable()
export class SuspendedUserMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SuspendedUserMiddleware.name);

  constructor(
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void) {
    const user = req['user'];

    if (!user || !user.id) {
      // No user, let authentication handle this
      return next();
    }

    try {
      // Check if user is suspended
      const dbUser = await this.db
        .selectFrom('users')
        .select(['suspendedAt', 'suspensionReason'])
        .where('id', '=', user.id)
        .executeTakeFirst();

      if (dbUser?.suspendedAt) {
        this.logger.warn(`Blocked suspended user ${user.id} from accessing: ${req.url}`);
        
        throw new ForbiddenException({
          message: 'Account Suspended',
          reason: dbUser.suspensionReason || 'Your account has been suspended due to policy violations',
          suspendedAt: dbUser.suspendedAt,
          statusCode: 403,
          error: 'AccountSuspended',
        });
      }

      next();
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Error checking suspended status:`, error);
      next();
    }
  }
}

