import { prisma } from '@/lib/db';
import { getTenantProvider } from './providers';
import { AppError } from '@/lib/errors';

/** Conversation turns sent as context. Older turns are dropped. */
const MAX_HISTORY_MESSAGES = 30;
/** Published articles pulled as grounding candidates before scoring. */
const KB_CANDIDATE_LIMIT = 100;
/** Articles actually included in the prompt. */
const KB_CONTEXT_LIMIT = 3;
/** Characters of each article body included. */
const KB_EXCERPT_CHARS = 2000;

const REPLY_SYSTEM = `You draft replies for human support agents. Your draft is
reviewed and edited by an agent before it reaches the customer — it is not sent
automatically.

Ground every factual claim in the knowledge base excerpts provided. If the
excerpts don't cover the question, answer what you can and state plainly what
you could not confirm rather than guessing — the agent will fill the gap.

Write the reply itself and nothing else: no subject line, no "Here's a draft",
no notes to the agent. Match the customer's language. Keep it direct and warm,
answer the actual question first, and include only the steps the customer needs.`;

export interface KbCitation {
  id: string;
  title: string;
  slug: string;
}

export interface DraftedReply {
  content: string;
  citations: KbCitation[];
  model: string;
}

/**
 * Naive keyword scoring over published articles. The Meilisearch service in
 * the stack is not yet wired to an index; when it is, replace this with a
 * relevance query and keep the same return shape.
 */
function selectRelevantArticles<T extends { title: string; content: string; tags: string[] }>(
  articles: T[],
  query: string,
): T[] {
  const terms = Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((term) => term.length > 3),
    ),
  );
  if (terms.length === 0) return articles.slice(0, KB_CONTEXT_LIMIT);

  return articles
    .map((article) => {
      const title = article.title.toLowerCase();
      const body = article.content.toLowerCase();
      const tags = article.tags.map((tag) => tag.toLowerCase());
      const score = terms.reduce((total, term) => {
        let termScore = 0;
        if (title.includes(term)) termScore += 3;
        if (tags.some((tag) => tag.includes(term))) termScore += 2;
        if (body.includes(term)) termScore += 1;
        return total + termScore;
      }, 0);
      return { article, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, KB_CONTEXT_LIMIT)
    .map((entry) => entry.article);
}

export async function draftReply(params: {
  tenantId: string;
  conversationId: string;
}): Promise<DraftedReply> {
  const provider = await getTenantProvider(params.tenantId);

  const conversation = await prisma.conversation.findFirst({
    where: { id: params.conversationId, tenantId: params.tenantId },
    select: {
      channel: true,
      customer: { select: { displayName: true, email: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: MAX_HISTORY_MESSAGES,
        select: { role: true, content: true },
      },
    },
  });

  if (!conversation) {
    throw new AppError('Conversation not found', 404, 'NOT_FOUND');
  }

  const history = [...conversation.messages].reverse();
  if (history.length === 0) {
    throw new AppError('Conversation has no messages to reply to', 422, 'AI_NO_INPUT');
  }

  const lastCustomerMessage =
    [...history].reverse().find((message) => message.role === 'CUSTOMER')?.content ??
    history[history.length - 1].content;

  const candidates = await prisma.knowledgeBaseArticle.findMany({
    where: { tenantId: params.tenantId, status: 'PUBLISHED' },
    orderBy: { updatedAt: 'desc' },
    take: KB_CANDIDATE_LIMIT,
    select: { id: true, title: true, slug: true, content: true, tags: true },
  });

  const relevant = selectRelevantArticles(candidates, lastCustomerMessage);

  const kbBlock = relevant.length
    ? relevant
        .map(
          (article, index) =>
            `[${index + 1}] ${article.title}\n${article.content.slice(0, KB_EXCERPT_CHARS)}`,
        )
        .join('\n\n---\n\n')
    : '(No knowledge base articles matched this conversation.)';

  const transcript = history
    .map((message) => `${message.role}: ${message.content}`)
    .join('\n\n');

  const customerName =
    conversation.customer?.displayName || conversation.customer?.email || 'the customer';

  const content = await provider.generateText({
    system: REPLY_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          `Channel: ${conversation.channel}`,
          `Customer: ${customerName}`,
          '',
          'Knowledge base excerpts:',
          kbBlock,
          '',
          'Conversation so far:',
          transcript,
          '',
          'Draft the next agent reply.',
        ].join('\n'),
      },
    ],
  });

  return {
    content,
    citations: relevant.map(({ id, title, slug }) => ({ id, title, slug })),
    model: provider.model,
  };
}
