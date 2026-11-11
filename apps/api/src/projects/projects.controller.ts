import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../auth/session-auth.guard.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { AddProjectMemberDto } from './dto/add-project-member.dto.js';
import { UpdateProjectMemberRoleDto } from './dto/update-project-member-role.dto.js';
import { ProjectsService } from './projects.service.js';

@Controller('projects')
@UseGuards(SessionAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.projectsService.findAll(req.user.id);
  }

  @Get(':projectId/members')
  findMembers(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    if (projectId < 1) {
      throw new BadRequestException('Invalid project ID');
    }

    return this.projectsService.findMembers(projectId, req.user.id);
  }

  @Post()
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  create(@Body() body: CreateProjectDto, @Req() req: AuthenticatedRequest) {
    return this.projectsService.create(body.name, req.user.id);
  }

  @Post(':projectId/members')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  addMember(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() body: AddProjectMemberDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (projectId < 1) {
      throw new BadRequestException('Invalid project ID');
    }

    return this.projectsService.addMember(projectId, req.user.id, body);
  }

  @Patch(':projectId/members/:memberId')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  updateMemberRole(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() body: UpdateProjectMemberRoleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (projectId < 1 || memberId < 1) {
      throw new BadRequestException('Invalid project or member ID');
    }

    return this.projectsService.updateMemberRole(
      projectId,
      memberId,
      req.user.id,
      body,
    );
  }

  @Delete(':projectId/members/:memberId')
  removeMember(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    if (projectId < 1 || memberId < 1) {
      throw new BadRequestException('Invalid project or member ID');
    }

    return this.projectsService.removeMember(projectId, memberId, req.user.id);
  }
}
