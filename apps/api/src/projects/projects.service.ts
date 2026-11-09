import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
