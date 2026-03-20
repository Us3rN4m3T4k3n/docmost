import { Test, TestingModule } from '@nestjs/testing';
import { ScreenshotDetectionService } from './screenshot-detection.service';
import { UserRepo } from '@docmost/db/repos/user/user.repo';

const KYSELY_TOKEN = 'KyselyModuleConnectionToken';

/**
 * Builds a chainable Kysely mock with tracked spy calls.
 */
function buildKyselyMock() {
  const executeMock = jest.fn().mockResolvedValue([]);
  const executeTakeFirstMock = jest.fn().mockResolvedValue(undefined);

  const whereChain: any = {
    where: jest.fn(),
    execute: executeMock,
    executeTakeFirst: executeTakeFirstMock,
  };
  whereChain.where.mockReturnValue(whereChain);

  const setChain: any = {
    set: jest.fn(),
    where: jest.fn(),
    execute: executeMock,
  };
  setChain.set.mockReturnValue(setChain);
  setChain.where.mockReturnValue(setChain);

  const selectChain: any = {
    select: jest.fn(),
    selectAll: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    innerJoin: jest.fn(),
    groupBy: jest.fn(),
    execute: executeMock,
    executeTakeFirst: executeTakeFirstMock,
  };
  selectChain.select.mockReturnValue(selectChain);
  selectChain.selectAll.mockReturnValue(selectChain);
  selectChain.where.mockReturnValue(selectChain);
  selectChain.orderBy.mockReturnValue(selectChain);
  selectChain.limit.mockReturnValue(selectChain);
  selectChain.innerJoin.mockReturnValue(selectChain);
  selectChain.groupBy.mockReturnValue(selectChain);

  const valuesChain: any = {
    values: jest.fn(),
    returning: jest.fn(),
    execute: executeMock,
    executeTakeFirst: executeTakeFirstMock,
  };
  valuesChain.values.mockReturnValue(valuesChain);
  valuesChain.returning.mockReturnValue(valuesChain);

  const db: any = {
    insertInto: jest.fn().mockReturnValue(valuesChain),
    selectFrom: jest.fn().mockReturnValue(selectChain),
    updateTable: jest.fn().mockReturnValue(setChain),
    deleteFrom: jest.fn().mockReturnValue(whereChain),
    _mocks: {
      executeMock,
      executeTakeFirstMock,
      whereChain,
      setChain,
      selectChain,
      valuesChain,
    },
  };

  return db;
}

describe('ScreenshotDetectionService', () => {
  let service: ScreenshotDetectionService;
  let db: any;

  beforeEach(async () => {
    db = buildKyselyMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScreenshotDetectionService,
        {
          provide: KYSELY_TOKEN,
          useValue: db,
        },
        {
          provide: UserRepo,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ScreenshotDetectionService>(ScreenshotDetectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Test 1: logScreenshotAttempt inserts a row and returns new attempt count', () => {
    it('inserts one row into screenshotAttempts with correct fields and returns count', async () => {
      // Mock selectFrom count result = 0 (first attempt)
      db._mocks.executeTakeFirstMock.mockResolvedValueOnce({ count: '0' });
      // Mock insertInto execute to succeed
      db._mocks.executeMock.mockResolvedValueOnce([]);

      const result = await service.logScreenshotAttempt({
        method: 'keyboard',
        userAgent: 'Mozilla/5.0',
        userId: 'user-123',
        workspaceId: 'ws-123',
      });

      expect(db.selectFrom).toHaveBeenCalledWith('screenshotAttempts');
      expect(db.insertInto).toHaveBeenCalledWith('screenshotAttempts');
      expect(result.attemptCount).toBe(1);
      expect(result.success).toBe(true);
    });
  });

  describe('Test 2: logScreenshotAttempt at count 3 suspends user account', () => {
    it('calls updateTable(users).set({ suspendedAt }) when count reaches 3', async () => {
      // Mock selectFrom to return count = 2 (will become 3 after insert)
      db._mocks.executeTakeFirstMock.mockResolvedValueOnce({ count: '2' });
      // Mock insertInto execute to succeed
      db._mocks.executeMock.mockResolvedValueOnce([]);
      // Mock updateTable execute for suspension
      db._mocks.executeMock.mockResolvedValueOnce([]);

      const result = await service.logScreenshotAttempt({
        method: 'keyboard',
        userAgent: 'Mozilla/5.0',
        userId: 'user-123',
        workspaceId: 'ws-123',
      });

      expect(db.updateTable).toHaveBeenCalledWith('users');
      const setCall = db._mocks.setChain.set.mock.calls.find(
        (call: any[]) => call[0] && call[0].suspendedAt !== undefined,
      );
      expect(setCall).toBeDefined();
      expect(result.isSuspended).toBe(true);
    });
  });

  describe('Test 3: getUserStatus returns attemptCount and suspended flag', () => {
    it('queries screenshotAttempts count and users.suspendedAt, returns correct shape', async () => {
      // First executeTakeFirst = count query
      db._mocks.executeTakeFirstMock
        .mockResolvedValueOnce({ count: '2' })
        // Second executeTakeFirst = user row
        .mockResolvedValueOnce({ suspendedAt: null });

      const result = await service.getUserStatus('user-123');

      expect(result).toEqual(
        expect.objectContaining({
          attemptCount: 2,
          suspended: false,
        }),
      );
    });
  });

  describe('Test 4: resetUserAttempts deletes rows and clears suspendedAt', () => {
    it('calls deleteFrom(screenshotAttempts) and updateTable(users).set({ suspendedAt: null })', async () => {
      db._mocks.executeMock.mockResolvedValue([]);

      await service.resetUserAttempts('user-123');

      expect(db.deleteFrom).toHaveBeenCalledWith('screenshotAttempts');
      expect(db.updateTable).toHaveBeenCalledWith('users');
      const setCall = db._mocks.setChain.set.mock.calls.find(
        (call: any[]) => call[0] && call[0].suspendedAt === null,
      );
      expect(setCall).toBeDefined();
    });
  });

  describe('Test 5: getUsersWithViolations returns array with userId, email, attemptCount, lastAttempt, suspendedAt', () => {
    it('returns array of users with violations from db', async () => {
      db._mocks.executeMock.mockResolvedValueOnce([
        {
          userId: 'user-123',
          email: 'test@example.com',
          attemptCount: '3',
          lastAttempt: new Date('2026-03-20'),
          suspendedAt: new Date('2026-03-20'),
        },
      ]);

      const result = await service.getUsersWithViolations();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      const first = result[0];
      expect(first).toHaveProperty('userId');
      expect(first).toHaveProperty('email');
      expect(first).toHaveProperty('attemptCount');
      expect(first).toHaveProperty('lastAttempt');
      expect(first).toHaveProperty('suspendedAt');
    });
  });
});
