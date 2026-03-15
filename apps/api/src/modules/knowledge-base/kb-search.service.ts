import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';

interface QdrantSearchResult {
  id: string;
  score: number;
  payload: {
    articleId: string;
    chunkIndex: number;
    chunkText: string;
    organizationId: string;
  };
}

export interface SearchResultItem {
  article: Record<string, unknown>;
  score: number;
  chunkText: string;
}

interface SearchFilters {
  targetRole?: UserRole;
  lmsPlatform?: string;
  limit?: number;
}

@Injectable()
export class KbSearchService {
  private readonly logger = new Logger(KbSearchService.name);
  private readonly qdrantUrl = process.env.QDRANT_URL ?? 'http://localhost:6333';
  private readonly CHUNK_SIZE = 500;
  private readonly CHUNK_OVERLAP = 50;
  private readonly VECTOR_SIZE = 1536;

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiGateway: AiGatewayService,
  ) {}

  private getCollectionName(organizationId: string): string {
    return `kb_embeddings_${organizationId.replace(/-/g, '_')}`;
  }

  private splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + this.CHUNK_SIZE, text.length);
      chunks.push(text.slice(start, end));
      if (end >= text.length) break;
      start += this.CHUNK_SIZE - this.CHUNK_OVERLAP;
    }

    return chunks.filter((c) => c.trim().length > 0);
  }

  async ensureCollection(collectionName: string): Promise<void> {
    try {
      await axios.put(`${this.qdrantUrl}/collections/${collectionName}`, {
        vectors: {
          size: this.VECTOR_SIZE,
          distance: 'Cosine',
        },
      });
      this.logger.debug(`Qdrant collection ensured: ${collectionName}`);
    } catch (err) {
      const axiosErr = err as AxiosError;
      // 409 means already exists — that's fine
      if (axiosErr.response?.status === 409) {
        this.logger.debug(`Qdrant collection already exists: ${collectionName}`);
        return;
      }
      this.logger.error(`Failed to create Qdrant collection ${collectionName}: ${err}`);
      throw err;
    }
  }

  async indexArticle(articleId: string): Promise<void> {
    this.logger.debug(`Indexing KB article ${articleId}`);

    const article = await this.prisma.kbArticle.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      this.logger.warn(`Article ${articleId} not found for indexing`);
      return;
    }

    const chunks = this.splitIntoChunks(article.content);

    if (chunks.length === 0) {
      this.logger.warn(`No chunks generated for article ${articleId}`);
      return;
    }

    this.logger.debug(`Split article ${articleId} into ${chunks.length} chunks`);

    // Generate embeddings for all chunks
    let embeddings: number[][];
    try {
      const embeddingResponse = await this.aiGateway.embed({ text: chunks });
      embeddings = embeddingResponse.embeddings;
    } catch (err) {
      this.logger.error(`Failed to generate embeddings for article ${articleId}: ${err}`);
      return;
    }

    const collectionName = this.getCollectionName(article.organizationId);

    // Ensure Qdrant collection exists
    try {
      await this.ensureCollection(collectionName);
    } catch (err) {
      this.logger.error(`Failed to ensure Qdrant collection for article ${articleId}: ${err}`);
      return;
    }

    // Build Qdrant points
    const points = chunks.map((chunkText, index) => ({
      id: `${articleId.replace(/-/g, '')}_${index}`,
      vector: embeddings[index],
      payload: {
        articleId,
        chunkIndex: index,
        chunkText,
        organizationId: article.organizationId,
      },
    }));

    // Upsert vectors to Qdrant
    try {
      await axios.put(`${this.qdrantUrl}/collections/${collectionName}/points`, {
        points,
      });
      this.logger.debug(`Upserted ${points.length} vectors to Qdrant for article ${articleId}`);
    } catch (err) {
      this.logger.error(`Failed to upsert vectors to Qdrant for article ${articleId}: ${err}`);
      return;
    }

    // Delete existing embeddings for this article
    await this.prisma.kbEmbedding.deleteMany({ where: { articleId } });

    // Save embedding metadata to Postgres
    await this.prisma.kbEmbedding.createMany({
      data: chunks.map((chunkText, index) => ({
        articleId,
        chunkIndex: index,
        chunkText,
        targetRole: article.targetRole,
        lmsPlatform: article.lmsPlatform,
        metadata: {},
      })),
    });

    this.logger.log(`Indexed article ${articleId}: ${chunks.length} chunks stored`);
  }

  async search(
    organizationId: string,
    query: string,
    filters: SearchFilters = {},
  ): Promise<SearchResultItem[]> {
    const { limit = 5 } = filters;

    this.logger.debug(`Searching KB for org ${organizationId}: "${query}"`);

    // Get embedding for query
    let queryEmbedding: number[];
    try {
      const embeddingResponse = await this.aiGateway.embed({ text: query });
      queryEmbedding = embeddingResponse.embeddings[0];
    } catch (err) {
      this.logger.error(`Failed to embed search query: ${err}`);
      return [];
    }

    const collectionName = this.getCollectionName(organizationId);

    // Search Qdrant
    let qdrantResults: QdrantSearchResult[] = [];
    try {
      const response = await axios.post<{ result: QdrantSearchResult[] }>(
        `${this.qdrantUrl}/collections/${collectionName}/points/search`,
        {
          vector: queryEmbedding,
          limit,
          with_payload: true,
        },
      );
      qdrantResults = response.data.result ?? [];
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 404) {
        // Collection doesn't exist yet — no articles indexed
        this.logger.debug(`Qdrant collection ${collectionName} not found — returning empty results`);
        return [];
      }
      this.logger.error(`Qdrant search failed for org ${organizationId}: ${err}`);
      return [];
    }

    if (qdrantResults.length === 0) return [];

    // De-duplicate article IDs while preserving highest score per article
    const bestByArticle = new Map<string, QdrantSearchResult>();
    for (const result of qdrantResults) {
      const { articleId } = result.payload;
      const existing = bestByArticle.get(articleId);
      if (!existing || result.score > existing.score) {
        bestByArticle.set(articleId, result);
      }
    }

    const articleIds = Array.from(bestByArticle.keys());

    // Build filter for role/platform if specified
    const articleWhere: Record<string, unknown> = {
      id: { in: articleIds },
      organizationId,
      status: 'PUBLISHED',
    };
    if (filters.targetRole) articleWhere.targetRole = filters.targetRole;
    if (filters.lmsPlatform) articleWhere.lmsPlatform = filters.lmsPlatform;

    const articles = await this.prisma.kbArticle.findMany({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: articleWhere as any,
      include: { category: true },
    });

    const articleMap = new Map(articles.map((a) => [a.id, a]));

    // Compose results in score order
    const results: SearchResultItem[] = [];
    for (const [articleId, qdrantResult] of bestByArticle.entries()) {
      const article = articleMap.get(articleId);
      if (!article) continue;
      results.push({
        article: article as unknown as Record<string, unknown>,
        score: qdrantResult.score,
        chunkText: qdrantResult.payload.chunkText,
      });
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    this.logger.debug(`Search returned ${results.length} results for query "${query}"`);
    return results;
  }
}
