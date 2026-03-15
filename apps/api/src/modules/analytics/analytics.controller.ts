import { Controller, Get, Query, UseGuards, Logger } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/guards/roles.guard';
import { Roles } from '../../infrastructure/decorators/roles.decorator';
import { OrganizationId } from '../../infrastructure/decorators/organization.decorator';
import { AnalyticsService, AnalyticsPeriod } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD, UserRole.AGENT)
@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get comprehensive dashboard statistics' })
  getDashboard(@OrganizationId() organizationId: string) {
    return this.analyticsService.getDashboardStats(organizationId);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get conversation metrics for a time period' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'], description: 'Time period (default 30d)' })
  getConversationMetrics(
    @OrganizationId() organizationId: string,
    @Query('period') period?: string,
  ) {
    const validPeriod = (['7d', '30d', '90d'].includes(period ?? '') ? period : '30d') as AnalyticsPeriod;
    return this.analyticsService.getConversationMetrics(organizationId, validPeriod);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'Get ticket metrics for a time period' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'], description: 'Time period (default 30d)' })
  getTicketMetrics(
    @OrganizationId() organizationId: string,
    @Query('period') period?: string,
  ) {
    const validPeriod = (['7d', '30d', '90d'].includes(period ?? '') ? period : '30d') as AnalyticsPeriod;
    return this.analyticsService.getTicketMetrics(organizationId, validPeriod);
  }

  @Get('knowledge-base')
  @ApiOperation({ summary: 'Get top knowledge base articles by view count' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of articles to return (default 10)' })
  getTopKbArticles(
    @OrganizationId() organizationId: string,
    @Query('limit') limit?: string,
  ) {
    return this.analyticsService.getTopKbArticles(
      organizationId,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  // Legacy endpoints preserved for backwards compatibility
  @Get('tickets/trends')
  @ApiOperation({ summary: 'Get ticket creation/resolution trends (legacy)' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days (default 30)' })
  getTicketTrends(
    @OrganizationId() organizationId: string,
    @Query('days') days?: string,
  ) {
    return this.analyticsService.getTicketTrends(
      organizationId,
      days ? parseInt(days, 10) : 30,
    );
  }

  @Get('agents/performance')
  @ApiOperation({ summary: 'Get agent performance metrics' })
  getAgentPerformance(@OrganizationId() organizationId: string) {
    return this.analyticsService.getAgentPerformance(organizationId);
  }

  @Get('lms')
  @ApiOperation({ summary: 'Get LMS integration statistics' })
  getLmsStats(@OrganizationId() organizationId: string) {
    return this.analyticsService.getLmsStats(organizationId);
  }
}
