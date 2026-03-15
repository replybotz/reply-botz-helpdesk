import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { TicketStatus, TicketPriority, TicketSource, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/guards/roles.guard';
import { Roles } from '../../infrastructure/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../infrastructure/decorators/current-user.decorator';
import { OrganizationId } from '../../infrastructure/decorators/organization.decorator';
import { TicketsService, CreateTicketDto, UpdateTicketDto } from './tickets.service';
import { TicketCategoriesService } from './ticket-categories.service';

@ApiTags('Tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly categoriesService: TicketCategoriesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List tickets for the current organization' })
  @ApiQuery({ name: 'status', required: false, enum: TicketStatus })
  @ApiQuery({ name: 'priority', required: false, enum: TicketPriority })
  @ApiQuery({ name: 'assignedAgentId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @OrganizationId() organizationId: string,
    @Query('status') status?: TicketStatus,
    @Query('priority') priority?: TicketPriority,
    @Query('assignedAgentId') assignedAgentId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ticketsService.findAll(organizationId, {
      status,
      priority,
      assignedAgentId,
      categoryId,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a new ticket' })
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      subject: string;
      description?: string;
      customerId?: string;
      lmsUserId?: string;
      lmsPlatform?: string;
      lmsCourseId?: string;
      lmsAssignmentId?: string;
      userRole?: UserRole;
      priority?: TicketPriority;
      categoryId?: string;
      source?: TicketSource;
      metadata?: Record<string, unknown>;
    },
  ) {
    const dto: CreateTicketDto = {
      ...body,
      organizationId,
    };
    return this.ticketsService.create(dto, user.sub);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.TEAM_LEAD, UserRole.AGENT)
  @ApiOperation({ summary: 'Get ticket statistics for the current organization' })
  getStats(@OrganizationId() organizationId: string) {
    return this.ticketsService.getStats(organizationId);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get ticket categories for the current organization' })
  getCategories(@OrganizationId() organizationId: string) {
    return this.ticketsService.getCategories(organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a ticket by ID' })
  findOne(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.ticketsService.findOne(id, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a ticket' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.ticketsService.update(id, dto, user.sub);
  }

  @Post(':id/assign')
  @Roles(UserRole.ADMIN, UserRole.TEAM_LEAD, UserRole.AGENT)
  @ApiOperation({ summary: 'Assign a ticket to an agent' })
  assign(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body('agentId') agentId: string,
  ) {
    return this.ticketsService.assign(id, agentId, user.sub);
  }

  @Post(':id/comment')
  @ApiOperation({ summary: 'Add a comment to a ticket' })
  addComment(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body('content') content: string,
  ) {
    return this.ticketsService.addComment(id, content, user.role, user.sub);
  }

  @Post(':id/resolve')
  @Roles(UserRole.ADMIN, UserRole.TEAM_LEAD, UserRole.AGENT)
  @ApiOperation({ summary: 'Resolve a ticket' })
  resolve(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ticketsService.resolve(id, user.sub);
  }

  @Post(':id/close')
  @Roles(UserRole.ADMIN, UserRole.TEAM_LEAD, UserRole.AGENT)
  @ApiOperation({ summary: 'Close a ticket' })
  close(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ticketsService.close(id, user.sub);
  }
}
