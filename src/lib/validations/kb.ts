import { z } from 'zod';

export const createArticleSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  content: z.string().min(1, 'Content is required'),
  tags: z.array(z.string()).optional().default([]),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional().default('DRAFT'),
});

export const updateArticleSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
