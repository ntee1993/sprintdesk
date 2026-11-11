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

  async findMembers(projectId: number, userId: number) {
    const role = await this.projectAuthorization.getProjectRole(
      projectId,
      userId,
    );

    if (role === null) {
      throw new NotFoundException('Project not found');
    }

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [{ ownerId: userId }, { memberships: { some: { userId } } }],
      },
      select: {
        owner: { select: { id: true, name: true, email: true } },
        memberships: {
          select: {
            role: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (project === null) {
      throw new NotFoundException('Project not found');
    }

    return [
      {
        userId: project.owner.id,
        name: project.owner.name,
        email: project.owner.email,
        role: 'OWNER' as const,
      },
      ...project.memberships
        .filter((membership) => membership.user.id !== project.owner.id)
        .map((membership) => ({
          userId: membership.user.id,
          name: membership.user.name,
          email: membership.user.email,
          role: membership.role,
        })),
    ];
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
