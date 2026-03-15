import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { KbArticlesService } from './kb-articles.service';
import { KbSearchService } from './kb-search.service';
import { KbArticlesController } from './kb-articles.controller';

@Module({
  imports: [AiGatewayModule],
  controllers: [KbArticlesController],
  providers: [KbArticlesService, KbSearchService],
  exports: [KbArticlesService, KbSearchService],
})
export class KnowledgeBaseModule {}
