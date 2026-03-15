import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService, SendMessageDto } from './messages.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/conversations' })
export class ConversationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ConversationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(private readonly messagesService: MessagesService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_conversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const { conversationId } = data;
    client.join(conversationId);
    this.logger.log(`Client ${client.id} joined conversation room: ${conversationId}`);
    return { event: 'joined_conversation', data: { conversationId } };
  }

  @SubscribeMessage('leave_conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const { conversationId } = data;
    client.leave(conversationId);
    this.logger.log(`Client ${client.id} left conversation room: ${conversationId}`);
    return { event: 'left_conversation', data: { conversationId } };
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      content: string;
      senderType: string;
      senderId?: string;
      contentType?: string;
    },
  ) {
    const { conversationId, content, senderType, senderId, contentType } = data;

    const dto: SendMessageDto = {
      conversationId,
      content,
      senderType: senderType as any,
      senderId,
      contentType: contentType as any,
    };

    try {
      const result = await this.messagesService.sendMessage(dto);
      this.server.to(conversationId).emit('new_message', result);
      return { event: 'message_sent', data: result };
    } catch (err) {
      this.logger.error(
        `Failed to send message for conversation=${conversationId}: ${(err as Error).message}`,
        err,
      );
      client.emit('message_error', { error: (err as Error).message, conversationId });
      return { event: 'message_error', data: { error: (err as Error).message } };
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; senderId?: string; isTyping: boolean },
  ) {
    const { conversationId, senderId, isTyping } = data;
    client.to(conversationId).emit('typing', { senderId, isTyping, conversationId });
    return { event: 'typing_broadcast', data: { conversationId } };
  }

  emitToConversation(conversationId: string, event: string, data: unknown) {
    this.server.to(conversationId).emit(event, data);
    this.logger.debug(`Emitted event '${event}' to conversation room: ${conversationId}`);
  }
}
