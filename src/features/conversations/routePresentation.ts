import type { CoordinatedResult } from '../../services/householdRequestCoordinator.ts';
import type { AgentIntent } from '../../services/tabbyBrain.ts';
import type { ConversationRoutePresentation } from './model.ts';

const ROUTE_LABELS: Record<AgentIntent, string> = {
  billing: 'Bills',
  context: 'Home notes',
  chef: 'Kitchen',
  grocery: 'Pantry',
  general: 'Tabby',
};

function resultSummary(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as { summary?: unknown; message?: unknown; title?: unknown };
  for (const field of [candidate.summary, candidate.message, candidate.title]) {
    if (typeof field === 'string' && field.trim()) return field.trim();
  }
  return undefined;
}

export function routeLabel(intent: AgentIntent): string {
  return ROUTE_LABELS[intent];
}

export function pendingRoutePresentation(intents: AgentIntent[]): ConversationRoutePresentation[] {
  return intents.map(intent => ({ intent, status: 'pending' }));
}

export function completedRoutePresentation(result: CoordinatedResult): ConversationRoutePresentation[] {
  return result.routes.map(route => ({
    intent: route.intent,
    status: route.status,
    summary: route.status === 'acknowledged' ? resultSummary(route.value) : undefined,
    error: route.status === 'failed' ? route.error || 'This route could not finish.' : undefined,
  }));
}
