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
    // TODO: uncomment after Plan 01-01 adds @AuthWorkspace to getPage
    // and adds workspaceId filter to PageRepo.findById
    it.skip('should return NotFoundException when pageId belongs to a different workspace', async () => {
      // Setup: findById returns null when workspaceId filter is applied
      mockPageRepo.findById.mockResolvedValueOnce(null);

      // Act & Assert: calling getPage with a valid pageId but wrong workspace
      // should throw NotFoundException (or equivalent).
      // Plan 01-01 will add the workspace parameter and workspaceId filtering.
      const getPageAny = controller.getPage as (...args: any[]) => any;
      await expect(
        getPageAny(
          { pageId: 'valid-uuid-from-other-workspace', includeSpace: true, includeContent: true },
          mockUser,
          mockWorkspace, // workspace B — different from the page's workspace
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when page is not found', async () => {
      mockPageRepo.findById.mockResolvedValueOnce(null);

      await expect(
        controller.getPage(
          { pageId: 'nonexistent-page-id', includeSpace: true, includeContent: true },
          mockUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
