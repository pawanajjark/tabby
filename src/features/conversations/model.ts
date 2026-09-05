import type { AgentIntent } from '../../services/tabbyBrain.ts';

export type ConversationDeliveryStatus = 'sending' | 'unsent' | 'rejected' | 'sent';
export type RoutePresentationStatus = 'pending' | 'acknowledged' | 'failed' | 'unavailable';

export interface ConversationRoutePresentation {
  intent: AgentIntent;
  status: RoutePresentationStatus;
  summary?: string;
  error?: string;
}

export interface ConversationMessageRecord {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
  readAt?: string;
  delivery?: ConversationDeliveryStatus;
  routes?: ConversationRoutePresentation[];
}

export interface ConversationRecord {
  id: string;
  title?: string;
  messages: ConversationMessageRecord[];
}

export interface ConversationFeatureState {
  conversations: ConversationRecord[];
  query: string;
  activeConversationId: string | null;
}

export type ConversationAction =
  | { type: 'replace'; conversations: ConversationRecord[] }
  | { type: 'search'; query: string }
  | { type: 'select'; conversationId: string; readAt?: string }
  | { type: 'upsert'; conversation: ConversationRecord }
  | { type: 'message_delivery'; messageId: string; delivery: ConversationDeliveryStatus }
  | { type: 'message_routes'; messageId: string; routes: ConversationRoutePresentation[] };

export function createConversationState(conversations: ConversationRecord[] = []): ConversationFeatureState {
  return { conversations, query: '', activeConversationId: null };
}

function updateMessage(
  conversations: ConversationRecord[],
  messageId: string,
  update: (message: ConversationMessageRecord) => ConversationMessageRecord,
): ConversationRecord[] {
  return conversations.map(conversation => ({
    ...conversation,
    messages: conversation.messages.map(message => message.id === messageId ? update(message) : message),
  }));
}

export function reduceConversationState(
  state: ConversationFeatureState,
  action: ConversationAction,
): ConversationFeatureState {
  switch (action.type) {
    case 'replace':
      return { ...state, conversations: action.conversations };
    case 'search':
      return { ...state, query: action.query };
    case 'select': {
      const readAt = action.readAt ?? new Date().toISOString();
      return {
        ...state,
        activeConversationId: action.conversationId,
        conversations: state.conversations.map(conversation => conversation.id === action.conversationId
          ? {
              ...conversation,
              messages: conversation.messages.map(message => message.role === 'assistant' && !message.readAt
                ? { ...message, readAt }
                : message),
            }
          : conversation),
      };
    }
    case 'upsert': {
      const exists = state.conversations.some(conversation => conversation.id === action.conversation.id);
      return {
        ...state,
        conversations: exists
          ? state.conversations.map(conversation => conversation.id === action.conversation.id ? action.conversation : conversation)
          : [...state.conversations, action.conversation],
      };
    }
    case 'message_delivery':
      return {
        ...state,
        conversations: updateMessage(state.conversations, action.messageId, message => ({ ...message, delivery: action.delivery })),
      };
    case 'message_routes':
      return {
        ...state,
        conversations: updateMessage(state.conversations, action.messageId, message => ({ ...message, routes: action.routes })),
      };
  }
}
