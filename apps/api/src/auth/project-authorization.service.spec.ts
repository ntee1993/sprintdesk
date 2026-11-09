import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProjectAuthorizationService } from './project-authorization.service.js';

describe('ProjectAuthorizationService', () => {
  let service: ProjectAuthorizationService;
  let findUniqueMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findUniqueMock = vi.fn();

    service = new ProjectAuthorizationService({
      project: {
        findUnique: findUniqueMock,
      },
    } as unknown as PrismaService);
  });

  it('returns null when the project does not exist', async () => {
    findUniqueMock.mockResolvedValue(null);

    const result = await service.getProjectRole(1, 10);

    expect(result).toBeNull();
  });

  it('returns OWNER when the user owns the project', async () => {
    findUniqueMock.mockResolvedValue({
      ownerId: 1,
      memberships: [],
    });

    const result = await service.getProjectRole(1, 1);

    expect(result).toBe('OWNER');
    expect(findUniqueMock).toHaveBeenCalledExactlyOnceWith({
      where: { id: 1 },
      select: {
        ownerId: true,
        memberships: {
          where: { userId: 1 },
          select: { role: true },
        },
      },
    });
  });

  it('returns EDITOR for an editor membership', async () => {
    findUniqueMock.mockResolvedValue({
      ownerId: 2,
      memberships: [{ role: 'EDITOR' }],
    });

    const result = await service.getProjectRole(1, 10);

    expect(result).toBe('EDITOR');
  });

  it('returns VIEWER for a viewer membership', async () => {
    findUniqueMock.mockResolvedValue({
      ownerId: 2,
      memberships: [{ role: 'VIEWER' }],
    });

    const result = await service.getProjectRole(1, 10);

    expect(result).toBe('VIEWER');
  });

  it('returns null when the user is not a member', async () => {
    findUniqueMock.mockResolvedValue({
      ownerId: 2,
      memberships: [],
    });

    const result = await service.getProjectRole(1, 10);

    expect(result).toBeNull();
  });
});
