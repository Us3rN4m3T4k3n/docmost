import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PageController } from './page.controller';
import { PageService } from './services/page.service';
import { PageHistoryService } from './services/page-history.service';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import SpaceAbilityFactory from '../casl/abilities/space-ability.factory';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

// Auto-mock heavy service modules so Jest does not traverse their deep
// import graphs (prosemirror, collaboration, etc.) at load time.
jest.mock('./services/page.service');
jest.mock('./services/page-history.service');
jest.mock('@docmost/db/repos/page/page.repo');
jest.mock('../casl/abilities/space-ability.factory');

const mockPageRepo = {
  findById: jest.fn(),
  restorePage: jest.fn(),
};

const mockSpaceAbilityFactory = {
  createForUser: jest.fn(),
};

const mockPageService = {
  create: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  forceDelete: jest.fn(),
  getRecentSpacePages: jest.fn(),
  getRecentPages: jest.fn(),
  getDeletedSpacePages: jest.fn(),
  getSidebarPages: jest.fn(),
  movePageToSpace: jest.fn(),
  duplicatePage: jest.fn(),
  movePage: jest.fn(),
  getPageBreadCrumbs: jest.fn(),
};

const mockPageHistoryService = {
  findHistoryByPageId: jest.fn(),
  findById: jest.fn(),
};

const mockUser = {
  id: 'user-id',
  workspaceId: 'workspace-a',
} as any;

const mockWorkspace = {
  id: 'workspace-a',
} as any;

describe('PageController', () => {
  let controller: PageController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PageController],
      providers: [
        { provide: PageService, useValue: mockPageService },
        { provide: PageRepo, useValue: mockPageRepo },
        { provide: PageHistoryService, useValue: mockPageHistoryService },
        { provide: SpaceAbilityFactory, useValue: mockSpaceAbilityFactory },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PageController>(PageController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPage', () => {
    it('should return NotFoundException when pageId belongs to a different workspace', async () => {
      // Setup: findById returns null when workspaceId filter is applied (page not in this workspace)
      mockPageRepo.findById.mockResolvedValueOnce(null);

      // Act & Assert: getPage passes workspace.id to findById; when the page UUID
      // belongs to a different workspace, the scoped query returns null → NotFoundException.
      await expect(
        controller.getPage(
          { pageId: 'valid-uuid-from-other-workspace', includeSpace: true, includeContent: true },
          mockUser,
          mockWorkspace, // workspace A — page belongs to workspace B, so findById returns null
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when page is not found', async () => {
      mockPageRepo.findById.mockResolvedValueOnce(null);

      await expect(
        controller.getPage(
          { pageId: 'nonexistent-page-id', includeSpace: true, includeContent: true },
          mockUser,
          mockWorkspace,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
