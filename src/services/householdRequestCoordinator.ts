import { TabbyBrain, type AgentIntent, type BrainAnalysis, type SharedContextRecord } from './tabbyBrain.ts';

export interface CoordinatedRequest {
  requestId: string;
  message: string;
  analysis: BrainAnalysis;
}

export interface RouteResult<T = unknown> {
  intent: AgentIntent;
  status: 'acknowledged' | 'failed' | 'unavailable';
  value?: T;
  error?: string;
}

export type IntentHandler<T = unknown> = (request: CoordinatedRequest) => Promise<T> | T;
export type IntentHandlers = Partial<Record<AgentIntent, IntentHandler>>;

export interface CoordinatedResult {
  requestId: string;
  intents: AgentIntent[];
  routes: RouteResult[];
  acknowledged: boolean;
}

function requestId(): string {
  if (globalThis.crypto?.randomUUID) return `request_${globalThis.crypto.randomUUID()}`;
  return `request_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export class HouseholdRequestCoordinator {
  private readonly handlers: IntentHandlers;

  constructor(handlers: IntentHandlers) {
    this.handlers = handlers;
  }

  async coordinate(
    message: string,
    recentHistory: Array<{ role: string; text?: string }> = [],
    context: SharedContextRecord[] = [],
  ): Promise<CoordinatedResult> {
    const analysis = await TabbyBrain.analyze(message, recentHistory, context);
    const request: CoordinatedRequest = { requestId: requestId(), message, analysis };
    const routes: RouteResult[] = [];

    // Serial execution keeps the classifier's stable route order observable.
    for (const intent of analysis.intents) {
      const handler = this.handlers[intent];
      if (!handler) {
        routes.push({ intent, status: 'unavailable' });
        continue;
      }
      try {
        const value = await handler(request);
        routes.push({ intent, status: 'acknowledged', value });
      } catch (error) {
        routes.push({
          intent,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      requestId: request.requestId,
      intents: analysis.intents,
      routes,
      acknowledged: routes.length > 0 && routes.every(route => route.status === 'acknowledged'),
    };
  }
}
