import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectAuthorizationService } from '../auth/project-authorization.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AddProjectMemberDto } from './dto/add-project-member.dto.js';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAuthorization: ProjectAuthorizationService,
  ) {}

  findAll(userId: number) {
    return this.prisma.project.findMany({
      where: {
        OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
      },
      orderBy: { id: 'asc' },
    });
  }

  async create(name: string, ownerId: number) {
    return this.prisma.project.create({
      data: { name, ownerId },
    });
  }

  async addMember(projectId: number, userId: number, dto: AddProjectMemberDto) {
    const role = await this.projectAuthorization.getProjectRole(
      projectId,
      userId,
    );

    if (role !== 'OWNER') {
      throw new ForbiddenException('Only project owners can add members');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (user === null) {
      throw new NotFoundException('User not found');
    }

    try {
      return await this.prisma.projectMember.create({
        data: { projectId, userId: user.id, role: dto.role },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('User is already a project member');
      }

      throw error;
    }
  }
}
