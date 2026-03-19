import { Test, TestingModule } from '@nestjs/testing';
import { LocaleDetectionService } from './locale-detection.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';

describe('LocaleDetectionService', () => {
  let service: LocaleDetectionService;
  let userRepo: jest.Mocked<Pick<UserRepo, 'updateUser'>>;

  beforeEach(async () => {
    const mockUserRepo = {
      updateUser: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocaleDetectionService,
        { provide: UserRepo, useValue: mockUserRepo },
      ],
    }).compile();

    service = module.get<LocaleDetectionService>(LocaleDetectionService);
    userRepo = module.get(UserRepo);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should set pt-BR for Brazilian IP', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', countryCode: 'BR' }),
    } as Response);

    await service.detectAndSetLocale('user-id', 'ws-id', '189.28.0.1');

    expect(userRepo.updateUser).toHaveBeenCalledWith(
      { locale: 'pt-BR' },
      'user-id',
      'ws-id',
    );
  });

  it('should set en-US for non-Brazilian IP', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', countryCode: 'US' }),
    } as Response);

    await service.detectAndSetLocale('user-id', 'ws-id', '8.8.8.8');

    expect(userRepo.updateUser).toHaveBeenCalledWith(
      { locale: 'en-US' },
      'user-id',
      'ws-id',
    );
  });

  it('should fallback to en-US when API returns fail status', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'fail', countryCode: '' }),
    } as Response);

    await service.detectAndSetLocale('user-id', 'ws-id', '192.168.1.1');

    expect(userRepo.updateUser).toHaveBeenCalledWith(
      { locale: 'en-US' },
      'user-id',
      'ws-id',
    );
  });

  it('should fallback to en-US when fetch throws', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    await service.detectAndSetLocale('user-id', 'ws-id', '1.2.3.4');

    expect(userRepo.updateUser).toHaveBeenCalledWith(
      { locale: 'en-US' },
      'user-id',
      'ws-id',
    );
  });

  it('should fallback to en-US when response is not ok', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
    } as Response);

    await service.detectAndSetLocale('user-id', 'ws-id', '1.2.3.4');

    expect(userRepo.updateUser).toHaveBeenCalledWith(
      { locale: 'en-US' },
      'user-id',
      'ws-id',
    );
  });
});
