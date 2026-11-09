import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Body,
  UsePipes,
  ValidationPipe,
  Param,
  ParseIntPipe,
  Patch,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ProjectAuthorizationService } from '../auth/project-authorization.service.js';
import {
  SessionAuthGuard,
  type AuthenticatedRequest,
} from '../auth/session-auth.guard.js';
import { TasksService } from './tasks.service.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskDto } from './dto/update-task.dto.js';
import { ListTasksQueryDto } from './dto/list-tasks-query.dto.js';

@Controller('tasks')
@UseGuards(SessionAuthGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly projectAuthorization: ProjectAuthorizationService,
  ) {}

  @Get()
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  findAll(@Query() query: ListTasksQueryDto, @Req() req: AuthenticatedRequest) {
    return this.tasksService.findAll(query, req.user.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.findOne(id, req.user.id);
  }

  @Post()
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async create(@Body() body: CreateTaskDto, @Req() req: AuthenticatedRequest) {
    const role = await this.projectAuthorization.getProjectRole(
      body.projectId,
      req.user.id,
    );

    if (role !== 'OWNER' && role !== 'EDITOR') {
      throw new ForbiddenException('Insufficient project permission');
    }

    return this.tasksService.create(body);
  }

  @Patch(':id')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() changes: UpdateTaskDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const task = await this.tasksService.findOne(id, req.user.id);
    const role = await this.projectAuthorization.getProjectRole(
      task.projectId,
      req.user.id,
    );

    if (role !== 'OWNER' && role !== 'EDITOR') {
      throw new ForbiddenException('Insufficient project permission');
    }

    return this.tasksService.update(id, changes, req.user.id);
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    const task = await this.tasksService.findOne(id, req.user.id);
    const role = await this.projectAuthorization.getProjectRole(
      task.projectId,
      req.user.id,
    );

    if (role !== 'OWNER' && role !== 'EDITOR') {
      throw new ForbiddenException('Insufficient project permission');
    }

    return this.tasksService.remove(id, req.user.id);
  }
}
