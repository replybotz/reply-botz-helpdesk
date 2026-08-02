jest.mock('@/lib/db', () => ({ prisma: {} }));

import { selectRelevantArticles } from '@/lib/ai/reply';

const articles = [
  {
    title: 'Resetting your password',
    content: 'Use the forgot password link on the sign in screen.',
    tags: ['account', 'login'],
  },
  {
    title: 'Billing cycles explained',
    content: 'Invoices are issued monthly and charged to the card on file.',
    tags: ['billing'],
  },
  {
    title: 'Exporting reports',
    content: 'Reports export to CSV from the analytics page.',
    tags: ['reports'],
  },
];

describe('selectRelevantArticles', () => {
  it('ranks the article whose title matches the question first', () => {
    const result = selectRelevantArticles(articles, 'I cannot reset my password');
    expect(result[0].title).toBe('Resetting your password');
  });

  it('matches on tags as well as body text', () => {
    const result = selectRelevantArticles(articles, 'question about billing charges');
    expect(result[0].title).toBe('Billing cycles explained');
  });

  it('drops articles that match nothing rather than padding the prompt', () => {
    const result = selectRelevantArticles(articles, 'kubernetes ingress configuration');
    expect(result).toEqual([]);
  });

  it('ignores short filler words when scoring', () => {
    // Terms of 3 characters or fewer are skipped, so only "password" scores —
    // otherwise "the"/"for" would match nearly every article.
    const result = selectRelevantArticles(articles, 'the password for my account');
    expect(result.map((article) => article.title)).toEqual(['Resetting your password']);
  });

  it('caps how many articles reach the prompt', () => {
    const many = Array.from({ length: 10 }, (_, index) => ({
      title: `Billing topic ${index}`,
      content: 'billing billing billing',
      tags: ['billing'],
    }));
    expect(selectRelevantArticles(many, 'billing').length).toBeLessThanOrEqual(3);
  });

  it('falls back to the newest articles when the query has no usable terms', () => {
    const result = selectRelevantArticles(articles, '?? 12 !!');
    expect(result).toHaveLength(3);
  });
});
