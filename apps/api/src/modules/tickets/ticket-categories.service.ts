import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

@Injectable()
export class TicketCategoriesService {
  private readonly logger = new Logger(TicketCategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(organizationId: string) {
    this.logger.debug(`Fetching ticket categories for org ${organizationId}`);
    return this.prisma.ticketCategory.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const category = await this.prisma.ticketCategory.findFirst({
      where: { id, organizationId },
    });
    if (!category) {
      throw new NotFoundException(`TicketCategory ${id} not found`);
    }
    return category;
  }
}
