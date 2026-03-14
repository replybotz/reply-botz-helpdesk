import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/guards/roles.guard';
import { Roles } from '../../infrastructure/decorators/roles.decorator';
import { OrganizationId } from '../../infrastructure/decorators/organization.decorator';
import { UserRole } from '@prisma/client';
import { OrganizationsService, UpdateOrganizationDto } from './organizations.service';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get current organization' })
  getCurrent(@OrganizationId() orgId: string) {
    return this.orgsService.findById(orgId);
  }

  @Put('current')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update current organization' })
  update(
    @OrganizationId() orgId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.orgsService.update(orgId, dto);
  }

  @Get('current/stats')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD)
  @ApiOperation({ summary: 'Get organization statistics' })
  getStats(@OrganizationId() orgId: string) {
    return this.orgsService.getStats(orgId);
  }
}
