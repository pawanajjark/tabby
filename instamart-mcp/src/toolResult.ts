type ContentItem = { type?: string; text?: string };

export function unwrapToolResult(result: unknown): any {
  if (!result || typeof result !== 'object') return result;
  const record = result as Record<string, unknown>;
  if ('structuredContent' in record && record.structuredContent) return record.structuredContent;
  if (Array.isArray(record.content)) {
    const text = (record.content as ContentItem[]).find(item => item.type === 'text' && item.text)?.text;
    if (text) {
      try { return JSON.parse(text); } catch { return { success: true, data: { message: text } }; }
    }
  }
  return result;
}

export function payload(result: unknown): any {
  const unwrapped = unwrapToolResult(result);
  if (unwrapped?.success === false) throw new Error(unwrapped?.error?.message || 'Instamart tool call failed.');
  return unwrapped?.data ?? unwrapped;
}
