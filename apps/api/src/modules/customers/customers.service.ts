import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { EncryptionService } from '../ferpa-compliance/encryption.service';
import { FerpaAuditService } from '../ferpa-compliance/ferpa-audit.service';

export interface CreateCustomerDto {
  organizationId: string;
  email?: string;
  name?: string;
  phone?: string;
  lmsUserId?: string;
  lmsPlatform?: string;
  role?: UserRole;
  metadata?: Record<string, unknown>;
}

export interface UpdateCustomerDto {
  name?: string;
  phone?: string;
  role?: UserRole;
  metadata?: Record<string, unknown>;
}

export interface CustomerFilters {
  search?: string;
  role?: UserRole;
  page?: number;
  limit?: number;
}

@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly ferpaAudit: FerpaAuditService,
  ) {}

  async create(dto: CreateCustomerDto, actorId?: string) {
    this.logger.log(`Creating customer for org=${dto.organizationId}`);

    const encryptedEmail = dto.email ? this.encryption.encrypt(dto.email) : undefined;
    const encryptedName = dto.name ? this.encryption.encrypt(dto.name) : undefined;
    const encryptedPhone = dto.phone ? this.encryption.encrypt(dto.phone) : undefined;

    const customer = await this.prisma.customer.create({
      data: {
        organizationId: dto.organizationId,
        email: encryptedEmail,
        name: encryptedName,
        phone: encryptedPhone,
        lmsUserId: dto.lmsUserId,
        lmsPlatform: dto.lmsPlatform,
        role: dto.role,
        metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Customer created id=${customer.id}`);

    if (dto.role === UserRole.STUDENT) {
      await this.ferpaAudit.log({
        resourceType: 'Customer',
        resourceId: customer.id,
        action: 'CUSTOMER_CREATED',
        actorId,
        studentId: dto.lmsUserId ?? customer.id,
      });
    }

    return this.decryptCustomer(customer);
  }

  async findOrCreate(
    organizationId: string,
    email: string,
    defaults?: Partial<CreateCustomerDto>,
  ) {
    this.logger.debug(`findOrCreate customer email=*** org=${organizationId}`);

    // Fetch all customers for org and compare decrypted emails
    const customers = await this.prisma.customer.findMany({
      where: { organizationId, email: { not: null } },
    });

    for (const c of customers) {
      if (c.email) {
        try {
          const decrypted = this.encryption.decrypt(c.email);
          if (decrypted === email) {
            this.logger.debug(`Found existing customer id=${c.id}`);
            return this.decryptCustomer(c);
          }
        } catch {
          // decryption failure for this record — skip
        }
      }
    }

    // Not found — create
    return this.create(
      {
        organizationId,
        email,
        ...defaults,
      },
      defaults?.metadata?.actorId as string | undefined,
    );
  }

  async findAll(organizationId: string, filters: CustomerFilters = {}) {
    const { role, page = 1, limit = 20 } = filters;

    const where: Prisma.CustomerWhereInput = {
      organizationId,
      ...(role ? { role } : {}),
    };

    const skip = (page - 1) * limit;

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    const decrypted = customers.map((c) => this.decryptCustomer(c));

    // Apply search filter on decrypted fields in-memory when a search term is provided
    const { search } = filters;
    const filtered = search
      ? decrypted.filter(
          (c) =>
            c.email?.toLowerCase().includes(search.toLowerCase()) ||
            c.name?.toLowerCase().includes(search.toLowerCase()),
        )
      : decrypted;

    return {
      data: filtered,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, actorId?: string, actorRole?: UserRole) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });

    if (!customer) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    if (customer.role === UserRole.STUDENT) {
      await this.ferpaAudit.log({
        resourceType: 'Customer',
        resourceId: customer.id,
        action: 'CUSTOMER_VIEWED',
        actorId,
        actorRole,
        studentId: customer.lmsUserId ?? customer.id,
      });
    }

    return this.decryptCustomer(customer);
  }

  async update(id: string, dto: UpdateCustomerDto, actorId?: string) {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Customer ${id} not found`);
    }

    const encryptedName = dto.name ? this.encryption.encrypt(dto.name) : undefined;
    const encryptedPhone = dto.phone ? this.encryption.encrypt(dto.phone) : undefined;

    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(encryptedName !== undefined ? { name: encryptedName } : {}),
        ...(encryptedPhone !== undefined ? { phone: encryptedPhone } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.metadata !== undefined
          ? { metadata: dto.metadata as Prisma.InputJsonValue }
          : {}),
      },
    });

    this.logger.log(`Customer ${id} updated by actor=${actorId}`);
    return this.decryptCustomer(updated);
  }

  async getConversationHistory(customerId: string, limit = 20) {
    return this.prisma.conversation.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        assignedAgent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getTicketHistory(customerId: string, limit = 20) {
    return this.prisma.ticket.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        category: true,
        assignedAgent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  private decryptCustomer<T extends { email?: string | null; name?: string | null; phone?: string | null }>(
    customer: T,
  ): T & { email?: string | null; name?: string | null; phone?: string | null } {
    return {
      ...customer,
      email: customer.email ? this.safeDecrypt(customer.email) : customer.email,
      name: customer.name ? this.safeDecrypt(customer.name) : customer.name,
      phone: customer.phone ? this.safeDecrypt(customer.phone) : customer.phone,
    };
  }

  private safeDecrypt(value: string): string {
    try {
      return this.encryption.decrypt(value);
    } catch {
      this.logger.warn('Failed to decrypt customer PII field');
      return '[decryption error]';
    }
  }
}
