import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Logger,
} from '@nestjs/common';
import { KbArticleStatus, KbArticleSource, UserRole } from '@prisma/client';
import { KbArticlesService, CreateKbArticleDto, UpdateKbArticleDto } from './kb-articles.service';
import { KbSearchService } from './kb-search.service';
import { CurrentUser, CurrentUserPayload } from '../../infrastructure/decorators/current-user.decorator';
import { OrganizationId } from '../../infrastructure/decorators/organization.decorator';
import { Roles } from '../../infrastructure/decorators/roles.decorator';

@Controller('knowledge-base')
export class KbArticlesController {
  private readonly logger = new Logger(KbArticlesController.name);

  constructor(
    private readonly kbArticlesService: KbArticlesService,
    private readonly kbSearchService: KbSearchService,
  ) {}

  @Get()
  async findAll(
    @OrganizationId() organizationId: string,
    @Query('status') status?: KbArticleStatus,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('lmsPlatform') lmsPlatform?: string,
    @Query('targetRole') targetRole?: UserRole,
    @Query('tags') tags?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.kbArticlesService.findAll(organizationId, {
      status,
      categoryId,
      search,
      lmsPlatform,
      targetRole,
      tags: tags ? tags.split(',').map((t) => t.trim()) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('search')
  async search(
    @OrganizationId() organizationId: string,
    @Query('q') query: string,
    @Query('targetRole') targetRole?: UserRole,
    @Query('lmsPlatform') lmsPlatform?: string,
    @Query('limit') limit?: string,
  ) {
    if (!query) {
      return [];
    }
    return this.kbSearchService.search(organizationId, query, {
      targetRole,
      lmsPlatform,
      limit: limit ? parseInt(limit, 10) : 5,
    });
  }

  @Get('categories')
  async getCategories(@OrganizationId() organizationId: string) {
    return this.kbArticlesService.getCategories(organizationId);
  }

  @Post()
  async create(
    @Body() dto: CreateKbArticleDto,
    @CurrentUser() user: CurrentUserPayload,
    @OrganizationId() organizationId: string,
  ) {
    return this.kbArticlesService.create(
      { ...dto, organizationId: dto.organizationId ?? organizationId },
      user?.sub,
    );
  }

  @Post('generate-from-ticket')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD, UserRole.AGENT)
  async generateFromTicket(
    @Body('ticketId') ticketId: string,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.kbArticlesService.generateFromTicket(ticketId, organizationId, user?.sub);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.kbArticlesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD, UserRole.AGENT)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateKbArticleDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.kbArticlesService.update(id, dto, user?.sub);
  }

  @Post(':id/publish')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD)
  async publish(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const article = await this.kbArticlesService.publish(id, user?.sub);

    // Trigger embedding generation asynchronously
    this.kbSearchService
      .indexArticle(id)
      .catch((err) => this.logger.error(`Failed to index article ${id} after publish: ${err}`));

    return article;
  }

  @Post(':id/archive')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TEAM_LEAD)
  async archive(@Param('id') id: string) {
    return this.kbArticlesService.archive(id);
  }

  @Post(':id/rate')
  async rate(
    @Param('id') id: string,
    @Body('helpful') helpful: boolean,
  ) {
    return this.kbArticlesService.rateArticle(id, helpful);
  }
}
