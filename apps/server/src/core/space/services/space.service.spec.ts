import { Test, TestingModule } from '@nestjs/testing';
import { SpaceService } from './space.service';
import { SpaceRepo } from '@docmost/db/repos/space/space.repo';
import { SpaceMemberService } from './space-member.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QueueName } from 'src/integrations/queue/constants';

const KYSELY_TOKEN = 'KyselyModuleConnectionToken';

describe('SpaceService', () => {
  let service: SpaceService;
  let spaceRepo: jest.Mocked<Partial<SpaceRepo>>;

  beforeEach(async () => {
    spaceRepo = {
      insertSpace: jest.fn(),
      updateSpace: jest.fn(),
      slugExists: jest.fn().mockResolvedValue(false),
    };

    const mockSpaceMemberService = {
      addUserToSpace: jest.fn(),
    };

    const mockKysely = {};

    const mockAttachmentQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpaceService,
        { provide: SpaceRepo, useValue: spaceRepo },
        { provide: SpaceMemberService, useValue: mockSpaceMemberService },
        { provide: KYSELY_TOKEN, useValue: mockKysely },
        {
          provide: getQueueToken(QueueName.ATTACHMENT_QUEUE),
          useValue: mockAttachmentQueue,
        },
      ],
    }).compile();

    service = module.get<SpaceService>(SpaceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create() language behavior', () => {
    const userId = 'user-123';
    const workspaceId = 'ws-456';

    it("create() should pass language to insertSpace", async () => {
      const mockSpace = { id: 'space-1', name: 'Test', slug: 'test', language: 'pt-BR' };
      (spaceRepo.insertSpace as jest.Mock).mockResolvedValue(mockSpace);

      await service.create(userId, workspaceId, {
        name: 'Test',
        slug: 'test',
        language: 'pt-BR',
      });

      expect(spaceRepo.insertSpace).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'pt-BR' }),
        undefined,
      );
    });

    it("create() should default language to en-US when not provided", async () => {
      const mockSpace = { id: 'space-2', name: 'Test', slug: 'test', language: 'en-US' };
      (spaceRepo.insertSpace as jest.Mock).mockResolvedValue(mockSpace);

      await service.create(userId, workspaceId, {
        name: 'Test',
        slug: 'test',
      } as any);

      expect(spaceRepo.insertSpace).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'en-US' }),
        undefined,
      );
    });
  });

  describe('updateSpace() language behavior', () => {
    const workspaceId = 'ws-456';

    it("updateSpace() should pass language to repo", async () => {
      const mockSpace = { id: 'space-1', name: 'Updated', slug: 'test', language: 'pt-BR' };
      (spaceRepo.updateSpace as jest.Mock).mockResolvedValue(mockSpace);

      await service.updateSpace(
        { spaceId: 'space-1', language: 'pt-BR' },
        workspaceId,
      );

      expect(spaceRepo.updateSpace).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'pt-BR' }),
        'space-1',
        workspaceId,
      );
    });

    it("updateSpace() should not include language when not provided", async () => {
      const mockSpace = { id: 'space-1', name: 'Updated', slug: 'test' };
      (spaceRepo.updateSpace as jest.Mock).mockResolvedValue(mockSpace);

      await service.updateSpace(
        { spaceId: 'space-1', name: 'Updated' },
        workspaceId,
      );

      const callArg = (spaceRepo.updateSpace as jest.Mock).mock.calls[0][0];
      expect(callArg.language).toBeUndefined();
    });
  });
});
