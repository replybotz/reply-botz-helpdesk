import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { CacheService } from '../../shared/cache/cache.service';

export interface UpdateOrganizationDto {
  name?: string;
  settings?: Record<string, unknown>;
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findById(id: string) {
    return this.cache.getOrSet(
      CacheService.keys.org(id),
      () =>
        this.prisma.organization.findUnique({
          where: { id },
          include: {
            _count: {
              select: { users: true, lmsIntegrations: true },
            },
          },
        }),
      300,
    );
  }

  async findBySlug(slug: string) {
    return this.cache.getOrSet(
      CacheService.keys.orgBySlug(slug),
      () => this.prisma.organization.findUnique({ where: { slug } }),
      300,
    );
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const org = await this.prisma.organization.update({
      where: { id },
      data: dto as Prisma.OrganizationUpdateInput,
    });
    await this.cache.del(CacheService.keys.org(id));
    return org;
  }

  async getStats(id: string) {
    const [userCount, integrationCount, ticketCount, conversationCount] = await Promise.all([
      this.prisma.user.count({ where: { organizationId: id } }),
      this.prisma.lmsIntegration.count({ where: { organizationId: id } }),
      this.prisma.ticket.count({ where: { organizationId: id } }),
      this.prisma.conversation.count({ where: { organizationId: id } }),
    ]);
    return { userCount, integrationCount, ticketCount, conversationCount };
  }
}
