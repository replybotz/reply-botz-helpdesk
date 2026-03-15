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
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/guards/roles.guard';
import { Roles } from '../../infrastructure/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../infrastructure/decorators/current-user.decorator';
import { OrganizationId } from '../../infrastructure/decorators/organization.decorator';
import { CustomersService, CreateCustomerDto, UpdateCustomerDto } from './customers.service';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.TEAM_LEAD, UserRole.AGENT)
  @ApiOperation({ summary: 'List customers for the current organization' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @OrganizationId() organizationId: string,
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.customersService.findAll(organizationId, {
      search,
      role,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.TEAM_LEAD, UserRole.AGENT)
  @ApiOperation({ summary: 'Create a customer' })
  create(
    @OrganizationId() organizationId: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body()
    body: {
      email?: string;
      name?: string;
      phone?: string;
      lmsUserId?: string;
      lmsPlatform?: string;
      role?: UserRole;
      metadata?: Record<string, unknown>;
    },
  ) {
    const dto: CreateCustomerDto = {
      ...body,
      organizationId,
    };
    return this.customersService.create(dto, user.sub);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.TEAM_LEAD, UserRole.AGENT)
  @ApiOperation({ summary: 'Get a customer by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.customersService.findOne(id, user.sub, user.role as UserRole);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.TEAM_LEAD, UserRole.AGENT)
  @ApiOperation({ summary: 'Update a customer' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, dto, user.sub);
  }

  @Get(':id/conversations')
  @Roles(UserRole.ADMIN, UserRole.TEAM_LEAD, UserRole.AGENT)
  @ApiOperation({ summary: 'Get conversation history for a customer' })
  @ApiQuery({ name: 'limit', required: false })
  getConversations(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.customersService.getConversationHistory(
      id,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get(':id/tickets')
  @Roles(UserRole.ADMIN, UserRole.TEAM_LEAD, UserRole.AGENT)
  @ApiOperation({ summary: 'Get ticket history for a customer' })
  @ApiQuery({ name: 'limit', required: false })
  getTickets(
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.customersService.getTicketHistory(
      id,
      limit ? parseInt(limit, 10) : undefined,
    );
  }
}
