export interface StoredConversationMessage {
  id: string;
  text?: string;
  attachmentName?: string;
  contentHtml?: string;
  pending?: boolean;
}

export function canPersistConversationMessage(message: StoredConversationMessage): boolean {
  if (message.pending) return false;
  return Boolean(message.text?.trim() || message.contentHtml?.trim());
}

export function encodeStoredConversationMessage(message: StoredConversationMessage): string {
  if (!canPersistConversationMessage(message)) throw new Error('Only completed conversation messages can be stored.');
  return JSON.stringify({ text: message.text, attachmentName: message.attachmentName, contentHtml: message.contentHtml });
}

export function decodeStoredConversationMessage(content: string): Pick<StoredConversationMessage, 'text' | 'attachmentName' | 'contentHtml'> {
  try {
    const parsed = JSON.parse(content) as { text?: string; attachmentName?: string; contentHtml?: string };
    if (parsed.text?.trim() || parsed.contentHtml?.trim()) return parsed;
  } catch {
    // Rows created before structured message storage are plain text.
  }
  return { text: content };
}
