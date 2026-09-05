import type {
  ConversationFeatureState,
  ConversationMessageRecord,
  ConversationRecord,
} from './model.ts';

export interface ConversationListItem {
  id: string;
  title: string;
  preview: string;
  updatedAt: string | null;
  unreadCount: number;
  active: boolean;
}

function timestamp(message: ConversationMessageRecord): number {
  const parsed = Date.parse(message.createdAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function lastMessage(conversation: ConversationRecord): ConversationMessageRecord | undefined {
  return [...conversation.messages].sort((left, right) => timestamp(right) - timestamp(left))[0];
}

export function conversationListItems(state: ConversationFeatureState): ConversationListItem[] {
  const query = state.query.trim().toLocaleLowerCase();
  return state.conversations
    .filter(conversation => {
      if (!query) return true;
      const searchable = [conversation.title ?? '', ...conversation.messages.map(message => message.text)]
        .join(' ')
        .toLocaleLowerCase();
      return searchable.includes(query);
    })
    .map(conversation => {
      const latest = lastMessage(conversation);
      const title = conversation.title?.trim() || 'Untitled conversation';
      return {
        id: conversation.id,
        title,
        preview: latest?.text.trim() ?? '',
        updatedAt: latest?.createdAt ?? null,
        unreadCount: conversation.id === state.activeConversationId
          ? 0
          : conversation.messages.filter(message => message.role === 'assistant' && !message.readAt).length,
        active: conversation.id === state.activeConversationId,
      };
    })
    .sort((left, right) => Date.parse(right.updatedAt ?? '') - Date.parse(left.updatedAt ?? '') || left.id.localeCompare(right.id));
}

export function activeConversation(state: ConversationFeatureState): ConversationRecord | null {
  return state.conversations.find(conversation => conversation.id === state.activeConversationId) ?? null;
}

export function formatConversationTimestamp(
  value: string | null,
  now = new Date(),
  locale = 'en',
): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  if (sameDay) return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(date);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.getFullYear() === yesterday.getFullYear()
    && date.getMonth() === yesterday.getMonth()
    && date.getDate() === yesterday.getDate();
  if (isYesterday) return 'Yesterday';
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date);
}
