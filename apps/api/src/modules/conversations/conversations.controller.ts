import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Logger,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { ConversationChannel, ConversationStatus, MessageSenderType } from '@prisma/client';
import { ConversationsService, CreateConversationDto, UpdateConversationDto } from './conversations.service';
import { MessagesService, SendMessageDto } from './messages.service';
import { HandoffsService, RequestHandoffDto } from './handoffs.service';
import { CurrentUser, CurrentUserPayload } from '../../infrastructure/decorators/current-user.decorator';
import { OrganizationId } from '../../infrastructure/decorators/organization.decorator';

@ApiTags('Conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly handoffsService: HandoffsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all conversations for the organization' })
  @ApiQuery({ name: 'status', enum: ConversationStatus, required: false })
  @ApiQuery({ name: 'channel', enum: ConversationChannel, required: false })
  @ApiQuery({ name: 'assignedAgentId', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @OrganizationId() organizationId: string,
    @Query('status') status?: ConversationStatus,
    @Query('channel') channel?: ConversationChannel,
    @Query('assignedAgentId') assignedAgentId?: string,
    @Query('customerId') customerId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.conversationsService.findAll(organizationId, {
      status,
      channel,
      assignedAgentId,
      customerId,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a new conversation' })
  async create(
    @Body() dto: CreateConversationDto,
    @CurrentUser() user: CurrentUserPayload,
    @OrganizationId() organizationId: string,
  ) {
    return this.conversationsService.create(
      { ...dto, organizationId },
      user.sub,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @OrganizationId() organizationId: string,
  ) {
    return this.conversationsService.findOne(id, organizationId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.conversationsService.update(id, dto, user.sub);
  }

  @Post(':id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.conversationsService.resolve(id, user.sub);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Close a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  async close(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.conversationsService.close(id, user.sub);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get messages for a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  @ApiQuery({ name: 'before', required: false, description: 'Fetch messages before this ISO date' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('before') before?: string,
    @Query('limit') limit?: number,
  ) {
    const beforeDate = before ? new Date(before) : undefined;
    return this.messagesService.getMessages(id, beforeDate, limit ? Number(limit) : undefined);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message in a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  async sendMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.messagesService.sendMessage({
      ...dto,
      conversationId: id,
      senderId: dto.senderId ?? user.sub,
    });
  }

  @Post(':id/handoff')
  @ApiOperation({ summary: 'Request a handoff for a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  async requestHandoff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestHandoffDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.handoffsService.requestHandoff({
      ...dto,
      conversationId: id,
      fromId: dto.fromId ?? user.sub,
    });
  }

  @Patch('handoffs/:handoffId/accept')
  @ApiOperation({ summary: 'Accept a handoff (agent action)' })
  @ApiParam({ name: 'handoffId', description: 'Handoff ID' })
  async acceptHandoff(
    @Param('handoffId', ParseUUIDPipe) handoffId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.handoffsService.acceptHandoff(handoffId, user.sub);
  }
}
