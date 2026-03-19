import { Injectable, Logger } from '@nestjs/common';
import { UserRepo } from '@docmost/db/repos/user/user.repo';

// Country-to-locale mapping. TODO: add new entries here as new language spaces are added.
const COUNTRY_LOCALE_MAP: Record<string, string> = {
  BR: 'pt-BR',
};

const DEFAULT_LOCALE = 'en-US';

@Injectable()
export class LocaleDetectionService {
  private readonly logger = new Logger(LocaleDetectionService.name);

  constructor(private readonly userRepo: UserRepo) {}

  async detectAndSetLocale(
    userId: string,
    workspaceId: string,
    clientIp: string,
  ): Promise<void> {
    try {
      const locale = await this.fetchLocaleFromIp(clientIp);
      await this.userRepo.updateUser({ locale }, userId, workspaceId);
    } catch (err) {
      this.logger.warn('locale detection failed, falling back to en-US:', err);
      await this.userRepo.updateUser(
        { locale: DEFAULT_LOCALE },
        userId,
        workspaceId,
      );
    }
  }

  private async fetchLocaleFromIp(ip: string): Promise<string> {
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,countryCode`,
    );

    if (!response.ok) {
      return DEFAULT_LOCALE;
    }

    const data = (await response.json()) as {
      status?: string;
      countryCode?: string;
    };

    if (data.status !== 'success') {
      return DEFAULT_LOCALE;
    }

    return COUNTRY_LOCALE_MAP[data.countryCode] ?? DEFAULT_LOCALE;
  }
}
