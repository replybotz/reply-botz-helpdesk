import { z } from 'zod';
import { getTenantProvider } from './providers';

/**
 * Providers with native JSON-schema support enforce this shape; the rest are
 * prompted with it and validated against it on the way back.
 */
export const triageSchema = z.object({
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  category: z
    .string()
    .describe('Short category slug, e.g. "billing", "bug", "account-access", "how-to"'),
  summary: z.string().describe('One sentence an agent can scan in a queue'),
  tags: z.array(z.string()).describe('Up to 5 lowercase keyword tags'),
  sentiment: z.enum(['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'FRUSTRATED']),
  needsHumanReview: z
    .boolean()
    .describe('True when the ticket is sensitive, legal, or too ambiguous to classify confidently'),
  reasoning: z.string().describe('Brief justification for the priority choice'),
});

export type TicketTriage = z.infer<typeof triageSchema>;

const TRIAGE_SYSTEM = `You triage incoming support tickets for a helpdesk.

Assign priority by customer impact and urgency:
- URGENT: production down, data loss, security incident, or a payment failure blocking the customer entirely.
- HIGH: a core workflow is broken with no workaround, or an angry customer at churn risk.
- MEDIUM: a broken or confusing feature that has a workaround.
- LOW: questions, how-tos, cosmetic issues, and feature requests.

Judge only from the ticket text. Do not invent details the customer did not
provide. Set needsHumanReview when the ticket involves legal, security, or
billing disputes, or is too ambiguous to classify confidently.`;

export async function triageTicket(params: {
  tenantId: string;
  subject: string;
  description: string;
}): Promise<{ triage: TicketTriage; model: string }> {
  const provider = await getTenantProvider(params.tenantId);

  const triage = await provider.generateObject({
    system: TRIAGE_SYSTEM,
    schema: triageSchema,
    schemaName: 'ticket_triage',
    messages: [
      {
        role: 'user',
        content: `Triage this ticket.\n\nSubject: ${params.subject}\n\nDescription:\n${params.description}`,
      },
    ],
  });

  return { triage, model: provider.model };
}
