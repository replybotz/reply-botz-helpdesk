import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/guards/roles.guard';
import { Roles } from '../../infrastructure/decorators/roles.decorator';
import { OrganizationId } from '../../infrastructure/decorators/organization.decorator';
import { UserRole } from '@prisma/client';
import { LmsIntegrationsService, CreateLmsIntegrationDto } from './lms-integrations.service';
import { Public } from '../../infrastructure/decorators/public.decorator';

@ApiTags('LMS Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lms')
export class LmsIntegrationsController {
  constructor(private readonly lmsService: LmsIntegrationsService) {}

  @Get('platforms')
  @Public()
  @ApiOperation({ summary: 'List all supported LMS platforms' })
  getSupportedPlatforms() {
    return this.lmsService.getSupportedPlatforms();
  }

  @Get()
  @ApiOperation({ summary: 'List LMS integrations for organization' })
  findAll(@OrganizationId() orgId: string) {
    return this.lmsService.findAll(orgId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new LMS integration' })
  create(
    @Body() dto: Omit<CreateLmsIntegrationDto, 'organizationId'>,
    @OrganizationId() orgId: string,
  ) {
    return this.lmsService.create({ ...dto, organizationId: orgId });
  }

  @Post(':id/sync')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Trigger an LMS sync' })
  triggerSync(
    @Param('id') id: string,
    @Query('type') type: 'users' | 'courses' | 'assignments' | 'all' = 'all',
  ) {
    return this.lmsService.triggerSync(id, type);
  }

  @Get(':id/test')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Test LMS integration connection' })
  testConnection(@Param('id') id: string) {
    return this.lmsService.testConnection(id);
  }

  @Get(':id/sync-logs')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get LMS sync logs' })
  getSyncLogs(@Param('id') id: string, @Query('limit') limit = 50) {
    return this.lmsService.getSyncLogs(id, limit);
  }

  @Post(':id/webhook')
  @Public()
  @ApiOperation({ summary: 'Receive LMS webhook event' })
  async receiveWebhook(
    @Param('id') _id: string,
    @Body() body: Record<string, unknown>,
  ) {
    // Platform-specific webhook processing handled by provider
    return { received: true };
  }
}
