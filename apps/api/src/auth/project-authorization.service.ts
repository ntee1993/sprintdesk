import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

type ProjectRole = 'OWNER' | 'EDITOR' | 'VIEWER';

@Injectable()
export class ProjectAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectRole(
    projectId: number,
    userId: number,
  ): Promise<ProjectRole | null> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        ownerId: true,
        memberships: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    if (project === null) {
      return null;
    }

    if (project.ownerId === userId) {
      return 'OWNER';
    }

    return project.memberships[0]?.role ?? null;
  }
}
