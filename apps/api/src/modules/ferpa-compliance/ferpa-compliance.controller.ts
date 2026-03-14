import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/guards/roles.guard';
import { Roles } from '../../infrastructure/decorators/roles.decorator';
import { CurrentUser } from '../../infrastructure/decorators/current-user.decorator';
import { OrganizationId } from '../../infrastructure/decorators/organization.decorator';
import { UserRole } from '@prisma/client';
import { FerpaAuditService } from './ferpa-audit.service';
import { FerpaConsentService, CreateConsentDto } from './ferpa-consent.service';
import { FerpaDataRequestService, CreateDataRequestDto } from './ferpa-data-request.service';

@ApiTags('FERPA Compliance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ferpa')
export class FerpaComplianceController {
  constructor(
    private readonly auditService: FerpaAuditService,
    private readonly consentService: FerpaConsentService,
    private readonly dataRequestService: FerpaDataRequestService,
  ) {}

  @Get('audit-log')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get FERPA audit log entries' })
  async getAuditLog(
    @OrganizationId() orgId: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('actorId') actorId?: string,
    @Query('limit') limit = 100,
  ) {
    if (resourceType && resourceId) {
      return this.auditService.findByResource(resourceType, resourceId, limit);
    }
    if (actorId) {
      return this.auditService.findByActor(actorId, limit);
    }
    return this.auditService.findByActor(orgId, limit);
  }

  @Post('consent')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.PARENT)
  @ApiOperation({ summary: 'Record FERPA consent' })
  async createConsent(
    @Body() dto: CreateConsentDto,
    @OrganizationId() orgId: string,
  ) {
    return this.consentService.createOrUpdate({ ...dto, organizationId: orgId });
  }

  @Get('consent/check')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AGENT)
  @ApiOperation({ summary: 'Check if student has given consent' })
  async checkConsent(
    @Query('studentId') studentId: string,
    @Query('consentType') consentType: string,
    @OrganizationId() orgId: string,
  ) {
    const hasConsent = await this.consentService.hasConsent(studentId, orgId, consentType);
    return { hasConsent };
  }

  @Post('data-requests')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.PARENT, UserRole.STUDENT)
  @ApiOperation({ summary: 'Submit FERPA data request (access, export, deletion)' })
  async createDataRequest(
    @Body() dto: Omit<CreateDataRequestDto, 'organizationId'>,
    @OrganizationId() orgId: string,
  ) {
    return this.dataRequestService.create({ ...dto, organizationId: orgId });
  }

  @Get('data-requests')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List FERPA data requests' })
  async listDataRequests(@OrganizationId() orgId: string) {
    return this.dataRequestService.findByOrganization(orgId);
  }
}
