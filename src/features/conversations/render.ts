import type { ConversationFeatureState, ConversationRoutePresentation } from './model.ts';
import { activeConversation, conversationListItems, formatConversationTimestamp } from './selectors.ts';
import type { StarterSuggestion } from './starters.ts';
import { routeLabel } from './routePresentation.ts';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]!);
}

function renderRoutes(routes: ConversationRoutePresentation[] = []): string {
  if (routes.length === 0) return '';
  return `<ol class="message-route-results" aria-label="Request progress">${routes.map(route => {
    const label = escapeHtml(routeLabel(route.intent));
    const detail = route.error || route.summary || (route.status === 'pending' ? 'Working…' : route.status === 'unavailable' ? 'Unavailable' : 'Done');
    return `<li class="message-route-result route-${route.status}" data-intent="${route.intent}"><strong>${label}</strong><span>${escapeHtml(detail)}</span></li>`;
  }).join('')}</ol>`;
}

function renderStarters(starters: StarterSuggestion[]): string {
  if (starters.length === 0) return '';
  return `<div class="empty-home-starters"><p>Start with a real household task.</p><div class="starter-suggestions">${starters.map(starter => `<button type="button" class="suggestion-chip" data-starter-prompt="${escapeHtml(starter.prompt)}">${escapeHtml(starter.label)}</button>`).join('')}</div></div>`;
}

export function renderConversationRoute(
  state: ConversationFeatureState,
  options: { now?: Date; locale?: string; starters?: StarterSuggestion[] } = {},
): string {
  const items = conversationListItems(state);
  const active = activeConversation(state);
  const searched = Boolean(state.query.trim());
  const listContent = items.length > 0
    ? items.map(item => `<button type="button" class="conversation-list-item${item.active ? ' active' : ''}" data-conversation-id="${escapeHtml(item.id)}"${item.active ? ' aria-current="true"' : ''}><span class="conversation-list-copy"><strong>${escapeHtml(item.title)}</strong><span class="conversation-preview">${escapeHtml(item.preview || 'No messages yet')}</span></span><span class="conversation-list-meta">${item.updatedAt ? `<time datetime="${escapeHtml(item.updatedAt)}">${escapeHtml(formatConversationTimestamp(item.updatedAt, options.now, options.locale))}</time>` : ''}${item.unreadCount ? `<span class="unread-count" aria-label="${item.unreadCount} unread">${item.unreadCount}</span>` : ''}</span></button>`).join('')
    : `<div class="conversation-list-empty"><strong>${searched ? 'No matching conversations' : 'No conversations yet'}</strong><p>${searched ? 'Try another title or message.' : 'Your private conversations will appear here.'}</p></div>`;

  const transcript = active
    ? `<header class="conversation-route-header"><h2>${escapeHtml(active.title?.trim() || 'Untitled conversation')}</h2></header><div class="conversation-transcript">${active.messages.map(message => `<article class="conversation-message message-${message.role}" data-message-id="${escapeHtml(message.id)}"><p>${escapeHtml(message.text)}</p><footer><time datetime="${escapeHtml(message.createdAt)}">${escapeHtml(formatConversationTimestamp(message.createdAt, options.now, options.locale))}</time>${message.delivery ? `<span class="message-delivery delivery-${message.delivery}">${message.delivery}</span>` : ''}</footer>${renderRoutes(message.routes)}</article>`).join('')}</div>`
    : `<div class="conversation-empty"><h2>${state.conversations.length ? 'Choose a conversation' : 'What should we handle first?'}</h2><p>${state.conversations.length ? 'Select one from your private conversation list.' : 'Nothing has been added on your behalf.'}</p></div>`;

  const reachableStarters = renderStarters(options.starters ?? []);
  return `<section class="conversation-feature-route" data-route-view="conversations"><aside class="conversation-index" aria-label="Conversations"><label class="conversation-search">Search conversations<input type="search" data-conversation-search value="${escapeHtml(state.query)}" /></label><div class="conversation-list">${listContent}</div>${reachableStarters}</aside><section class="conversation-detail">${transcript}</section></section>`;
}
