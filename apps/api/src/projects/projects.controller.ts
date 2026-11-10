import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { ProjectsService } from './projects.service.js';

@Controller('projects')
@UseGuards(SessionAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(@Req() req: AuthenticatedRequest) {
    return this.projectsService.findAll(req.user.id);
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
}
