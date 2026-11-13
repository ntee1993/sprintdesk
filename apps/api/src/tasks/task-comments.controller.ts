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
import { TaskCommentDto } from './dto/task-comment.dto.js';
import { TaskCommentsService } from './task-comments.service.js';

@Controller('tasks/:taskId/comments')
@UseGuards(SessionAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class TaskCommentsController {
  constructor(private readonly comments: TaskCommentsService) {}

  private positive(id: number): number {
    if (id < 1 || !Number.isSafeInteger(id))
      throw new BadRequestException('Invalid ID');
    return id;
  }

  @Get()
  findAll(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.comments.findAll(this.positive(taskId), req.user.id);
  }

  @Post()
  create(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() body: TaskCommentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.comments.create(
      this.positive(taskId),
      req.user.id,
      body.content,
    );
  }

  @Patch(':commentId')
  update(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() body: TaskCommentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.comments.update(
      this.positive(taskId),
      this.positive(commentId),
      req.user.id,
      body.content,
    );
  }

  @Delete(':commentId')
  remove(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.comments.remove(
      this.positive(taskId),
      this.positive(commentId),
      req.user.id,
    );
  }
}
