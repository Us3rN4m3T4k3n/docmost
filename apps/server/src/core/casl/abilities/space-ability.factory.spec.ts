import { Test, TestingModule } from '@nestjs/testing';
import SpaceAbilityFactory from './space-ability.factory';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../interfaces/space-ability.type';
import { SpaceRole } from '../../../common/helpers/types/permission';

const mockSpaceMemberRepo = {
  getUserSpaceRoles: jest.fn(),
};

async function getAbilityForRole(
  factory: SpaceAbilityFactory,
  mockRepo: typeof mockSpaceMemberRepo,
  role: SpaceRole,
) {
  mockRepo.getUserSpaceRoles.mockResolvedValueOnce([{ role }]);
  return factory.createForUser({ id: 'test-user-id' } as any, 'test-space-id');
}

describe('SpaceAbilityFactory', () => {
  let factory: SpaceAbilityFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpaceAbilityFactory,
        {
          provide: SpaceMemberRepo,
          useValue: mockSpaceMemberRepo,
        },
      ],
    }).compile();

    factory = module.get<SpaceAbilityFactory>(SpaceAbilityFactory);
    jest.clearAllMocks();
  });

  describe('READER ability', () => {
    it('can Read Page', async () => {
      const ability = await getAbilityForRole(
        factory,
        mockSpaceMemberRepo,
        SpaceRole.READER,
      );
      expect(ability.can(SpaceCaslAction.Read, SpaceCaslSubject.Page)).toBe(
        true,
      );
    });

    it('cannot Manage Page', async () => {
      const ability = await getAbilityForRole(
        factory,
        mockSpaceMemberRepo,
        SpaceRole.READER,
      );
      expect(ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page)).toBe(
        false,
      );
    });

    it('cannot Manage Settings', async () => {
      const ability = await getAbilityForRole(
        factory,
        mockSpaceMemberRepo,
        SpaceRole.READER,
      );
      expect(
        ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Settings),
      ).toBe(false);
    });

    it('cannot Manage Member', async () => {
      const ability = await getAbilityForRole(
        factory,
        mockSpaceMemberRepo,
        SpaceRole.READER,
      );
      expect(ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Member)).toBe(
        false,
      );
    });

    it('cannot Manage Share', async () => {
      const ability = await getAbilityForRole(
        factory,
        mockSpaceMemberRepo,
        SpaceRole.READER,
      );
      expect(ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Share)).toBe(
        false,
      );
    });
  });

  describe('WRITER ability', () => {
    it('can Manage Page', async () => {
      const ability = await getAbilityForRole(
        factory,
        mockSpaceMemberRepo,
        SpaceRole.WRITER,
      );
      expect(ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page)).toBe(
        true,
      );
    });

    it('can Manage Share', async () => {
      const ability = await getAbilityForRole(
        factory,
        mockSpaceMemberRepo,
        SpaceRole.WRITER,
      );
      expect(ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Share)).toBe(
        true,
      );
    });

    it('cannot Manage Settings', async () => {
      const ability = await getAbilityForRole(
        factory,
        mockSpaceMemberRepo,
        SpaceRole.WRITER,
      );
      expect(
        ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Settings),
      ).toBe(false);
    });

    it('cannot Manage Member', async () => {
      const ability = await getAbilityForRole(
        factory,
        mockSpaceMemberRepo,
        SpaceRole.WRITER,
      );
      expect(ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Member)).toBe(
        false,
      );
    });

    it('can Read Settings', async () => {
      const ability = await getAbilityForRole(
        factory,
        mockSpaceMemberRepo,
        SpaceRole.WRITER,
      );
      expect(ability.can(SpaceCaslAction.Read, SpaceCaslSubject.Settings)).toBe(
        true,
      );
    });
  });

  describe('ADMIN ability', () => {
    it('can Manage Page', async () => {
      const ability = await getAbilityForRole(
        factory,
        mockSpaceMemberRepo,
        SpaceRole.ADMIN,
      );
      expect(ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Page)).toBe(
        true,
      );
    });

    it('can Manage Settings', async () => {
      const ability = await getAbilityForRole(
        factory,
        mockSpaceMemberRepo,
        SpaceRole.ADMIN,
      );
      expect(
        ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Settings),
      ).toBe(true);
    });

    it('can Manage Member', async () => {
      const ability = await getAbilityForRole(
        factory,
        mockSpaceMemberRepo,
        SpaceRole.ADMIN,
      );
      expect(ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Member)).toBe(
        true,
      );
    });

    it('can Manage Share', async () => {
      const ability = await getAbilityForRole(
        factory,
        mockSpaceMemberRepo,
        SpaceRole.ADMIN,
      );
      expect(ability.can(SpaceCaslAction.Manage, SpaceCaslSubject.Share)).toBe(
        true,
      );
    });
  });
});
