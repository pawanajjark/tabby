import OpenAI from 'openai';
import { unwrapToolResult } from './toolResult.js';
import type { McpToolDefinition, ToolClient } from './types.js';
import { createShoppingStateStore, emptyShoppingState, type SelectedItem, type ShoppingAgentState, type ShoppingStateStore } from './shoppingState.js';

export interface ChatMessage { role: 'user' | 'assistant'; content: string; }
export interface ChatToolCall { name: string; arguments: Record<string, unknown>; result: unknown; }
export interface ChatReply { message: string; toolCalls: ChatToolCall[]; aiEnabled: boolean; }

export class InstamartChatAgent {
  private readonly openai: OpenAI | null;
  private readonly model: string;
  private readonly stateStore: ShoppingStateStore;

  constructor(private readonly tools: ToolClient, env = process.env, stateStore: ShoppingStateStore = createShoppingStateStore(env)) {
    this.openai = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
    this.model = env.OPENAI_MODEL || 'gpt-5.5';
    this.stateStore = stateStore;
  }

  get stateStoreKind(): ShoppingStateStore['kind'] { return this.stateStore.kind; }

  async reply(sessionId: string, messages: ChatMessage[]): Promise<ChatReply> {
    const recent = messages.slice(-16);
    const userText = recent.at(-1)?.content.trim() || '';
    if (!userText) throw new Error('Enter a message first.');
    const workflow = await this.handleShoppingWorkflow(sessionId, userText);
    if (workflow) return workflow;
    const direct = parseDirectTool(userText);
    if (direct) {
      const result = await this.executeTool(sessionId, direct.name, direct.arguments, userText);
      return { message: formatResult(direct.name, result), toolCalls: [{ ...direct, result }], aiEnabled: Boolean(this.openai) };
    }
    if (!this.openai) return this.fallbackReply(sessionId, userText);
    return this.aiReply(sessionId, recent, userText);
  }

  private async aiReply(sessionId: string, messages: ChatMessage[], userText: string): Promise<ChatReply> {
    const definitions = await this.tools.listTools();
    const functionTools = definitions.map(functionDefinition);
    const state = await this.loadState(sessionId);
    const transcript = messages.map(message => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`).join('\n\n');
    const toolCalls: ChatToolCall[] = [];
    let input: any[] = [{ role: 'user', content: `Persisted shopping state:\n${JSON.stringify(state)}\n\nConversation so far:\n${transcript}` }];
    for (let turn = 0; turn < 8; turn += 1) {
      const response = await this.openai!.responses.create({
        model: this.model,
        instructions: CHAT_INSTRUCTIONS,
        input,
        tools: functionTools as any,
        tool_choice: 'auto',
        parallel_tool_calls: false,
        store: false,
        reasoning: { effort: 'medium' },
        text: { verbosity: 'low' },
      });
      const calls = response.output.filter((item: any) => item.type === 'function_call') as any[];
      if (!calls.length) return { message: response.output_text || 'Done.', toolCalls, aiEnabled: true };
      const outputs: any[] = [];
      for (const call of calls) {
        const arguments_ = safeJsonObject(call.arguments);
        let result: unknown;
        try { result = await this.executeTool(sessionId, call.name, arguments_, userText); }
        catch (cause) { result = { success: false, error: cause instanceof Error ? cause.message : String(cause) }; }
        toolCalls.push({ name: call.name, arguments: arguments_, result });
        outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
      }
      input = [...input, ...response.output, ...outputs] as any;
    }
    return { message: 'I stopped after eight tool rounds. Review the trace and continue with a narrower request.', toolCalls, aiEnabled: true };
  }

  private async fallbackReply(sessionId: string, userText: string): Promise<ChatReply> {
    const lower = userText.toLowerCase();
    if (/^(help|what can you do|show tools|list tools)/.test(lower)) {
      const tools = await this.tools.listTools();
      return { message: `I can access ${tools.length} Instamart tools. Try “show my addresses”, “search for tomatoes”, “show my cart”, or /tool ${tools[0]?.name || 'get_addresses'} {}. Add OPENAI_API_KEY for unrestricted language routing.`, toolCalls: [], aiEnabled: false };
    }
    if (/address/.test(lower)) return this.singleToolReply(sessionId, 'get_addresses', {}, userText);
    if (/\b(cart|basket)\b/.test(lower)) return this.singleToolReply(sessionId, 'get_cart', {}, userText);
    if (/coupon|offer/.test(lower)) return this.singleToolReply(sessionId, 'list_coupons', {}, userText);
    if (/orders?|history/.test(lower)) return this.singleToolReply(sessionId, 'get_orders', {}, userText);
    const search = userText.match(/(?:search|find|look for)(?: instamart)?(?: for)?\s+(.+)/i);
    if (search) {
      const raw = unwrapToolResult(await this.tools.callTool('get_addresses', {})) as any;
      const address = raw?.data?.addresses?.[0] ?? raw?.addresses?.[0];
      if (!address?.id) throw new Error('No saved delivery address is available.');
      return this.singleToolReply(sessionId, 'search_products', { addressId: address.id, query: search[1].trim() }, userText);
    }
    return { message: 'Natural-language chat needs OPENAI_API_KEY. You can still call any MCP tool directly, for example: /tool get_addresses {}', toolCalls: [], aiEnabled: false };
  }

  private async singleToolReply(sessionId: string, name: string, arguments_: Record<string, unknown>, userText: string): Promise<ChatReply> {
    const result = await this.executeTool(sessionId, name, arguments_, userText);
    return { message: formatResult(name, result), toolCalls: [{ name, arguments: arguments_, result }], aiEnabled: false };
  }

  private async executeTool(sessionId: string, name: string, arguments_: Record<string, unknown>, userText: string): Promise<unknown> {
    const state = await this.loadState(sessionId);
    if (name !== 'checkout') {
      const result = unwrapToolResult(await this.tools.callTool(name, arguments_));
      this.applyToolEvidence(state, name, arguments_, result);
      await this.stateStore.save(state);
      return result;
    }
    const confirmedNow = /\b(yes|yeah|yep|confirm|confirmed|proceed|go ahead|place (?:the )?(?:developer )?order|checkout now)\b/i.test(userText)
      || /"confirmedByUser"\s*:\s*true/i.test(userText);
    if (!state.pendingConfirmation || state.phase !== 'awaiting_confirmation' || !confirmedNow || arguments_.confirmedByUser !== true) {
      const cart = unwrapToolResult(await this.tools.callTool('get_cart', {}));
      const addresses = unwrapToolResult(await this.tools.callTool('get_addresses', {}));
      const payments = unwrapToolResult(await this.tools.callTool('get_payment_options', {}));
      state.cart = cart;
      state.payment = payments;
      state.phase = 'awaiting_confirmation';
      state.pendingConfirmation = true;
      state.toolContext.push({ name: 'checkout_review', arguments: {}, result: { cart, addresses, payments } });
      await this.stateStore.save(state);
      return { success: false, requiresExplicitConfirmation: true, message: 'Show this refreshed cart, address, and payment methods. Ask for confirmation in a new message before checkout.', cart, addresses, payments };
    }
    const { confirmedByUser: _, ...upstreamArguments } = arguments_;
    const result = unwrapToolResult(await this.tools.callTool(name, upstreamArguments));
    state.phase = 'ordered';
    state.pendingConfirmation = false;
    state.toolContext.push({ name, arguments: upstreamArguments, result });
    await this.stateStore.save(state);
    return result;
  }

  private async handleShoppingWorkflow(sessionId: string, userText: string): Promise<ChatReply | null> {
    const state = await this.loadState(sessionId);
    const confirms = /^(?:yes|yeah|yep|confirm|confirmed|proceed|go ahead|place (?:the )?order|checkout now)\b/i.test(userText.trim());
    if (confirms && state.pendingConfirmation && state.phase === 'awaiting_confirmation') {
      const result = await this.executeTool(sessionId, 'checkout', { addressId: state.addressId, paymentMethod: preferredPayment(state.payment), confirmedByUser: true }, userText);
      return { message: summarizeOrder(result), toolCalls: [{ name: 'checkout', arguments: { addressId: state.addressId, paymentMethod: preferredPayment(state.payment) }, result }], aiEnabled: Boolean(this.openai) };
    }

    const request = extractItemRequest(userText);
    const refersToSelection = /\b(add (?:it|them|everything)|put (?:it|them) in (?:the )?cart)\b/i.test(userText);
    const wantsCheckout = /\b(check\s*out|checkout|place (?:the )?order|order (?:it|them|everything|now))\b/i.test(userText);
    const wantsAdd = wantsCheckout || /\b(add|put|cart)\b/i.test(userText);
    const calls: ChatToolCall[] = [];

    if (request) {
      if (!state.addressId) {
        const addresses = await this.callAndRecord(state, 'get_addresses', {}, calls);
        state.addressId = firstAddressId(addresses);
        if (!state.addressId) throw new Error('No saved Instamart address is available.');
      }
      const search = await this.callAndRecord(state, 'search_products', { addressId: state.addressId, query: request.name }, calls);
      const selection = selectProduct(search, request.quantity);
      if (!selection) throw new Error(`No Instamart product matched ${request.name}.`);
      state.requestedItems = [request];
      state.selectedItems = [selection];
      state.phase = 'selected';
    }

    if ((wantsAdd && state.selectedItems.length) || refersToSelection) {
      if (!state.selectedItems.length) return null;
      const cart = await this.callAndRecord(state, 'update_cart', { items: state.selectedItems.map(item => ({ spinId: item.spinId, quantity: item.quantity })) }, calls);
      state.cart = cart;
      state.phase = 'cart_ready';
    }

    if (wantsCheckout && state.selectedItems.length) {
      state.cart = await this.callAndRecord(state, 'get_cart', state.addressId ? { addressId: state.addressId } : {}, calls);
      state.payment = await this.callAndRecord(state, 'get_payment_options', {}, calls);
      state.phase = 'awaiting_confirmation';
      state.pendingConfirmation = true;
      await this.stateStore.save(state);
      return { message: checkoutReview(state), toolCalls: calls, aiEnabled: Boolean(this.openai) };
    }

    if (request || (refersToSelection && state.selectedItems.length)) {
      await this.stateStore.save(state);
      return { message: state.phase === 'cart_ready' ? cartSummary(state) : selectionSummary(state.selectedItems[0]), toolCalls: calls, aiEnabled: Boolean(this.openai) };
    }
    return null;
  }

  private async loadState(sessionId: string): Promise<ShoppingAgentState> {
    return await this.stateStore.load(sessionId) ?? emptyShoppingState(sessionId);
  }

  private async callAndRecord(state: ShoppingAgentState, name: string, arguments_: Record<string, unknown>, calls: ChatToolCall[]): Promise<unknown> {
    const result = unwrapToolResult(await this.tools.callTool(name, arguments_));
    calls.push({ name, arguments: arguments_, result });
    this.applyToolEvidence(state, name, arguments_, result);
    return result;
  }

  private applyToolEvidence(state: ShoppingAgentState, name: string, arguments_: Record<string, unknown>, result: unknown): void {
    state.toolContext.push({ name, arguments: arguments_, result });
    state.toolContext = state.toolContext.slice(-40);
    if (name === 'get_cart' || name === 'update_cart') state.cart = result;
    if (name === 'get_payment_options') state.payment = result;
  }
}

function functionDefinition(tool: McpToolDefinition): Record<string, unknown> {
  const parameters = tool.name === 'checkout' ? addCheckoutConfirmation(tool.inputSchema) : tool.inputSchema;
  return { type: 'function', name: tool.name, description: tool.description || `Call Instamart ${tool.name}.`, parameters, strict: false };
}

function addCheckoutConfirmation(schema: Record<string, unknown>): Record<string, unknown> {
  const properties = { ...((schema.properties as Record<string, unknown> | undefined) || {}), confirmedByUser: { type: 'boolean', description: 'True only when the current user message confirms the immediately preceding refreshed order review.' } };
  return { ...schema, type: 'object', properties };
}

function safeJsonObject(value: string): Record<string, unknown> {
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; }
  catch { return {}; }
}

function parseDirectTool(text: string): { name: string; arguments: Record<string, unknown> } | null {
  const match = text.match(/^\/tool\s+([a-z_]+)(?:\s+([\s\S]+))?$/i);
  return match ? { name: match[1], arguments: match[2] ? safeJsonObject(match[2]) : {} } : null;
}

function formatResult(name: string, result: unknown): string {
  return `${name} returned:\n\n\u0060\u0060\u0060json\n${JSON.stringify(result, null, 2)}\n\u0060\u0060\u0060`;
}

function extractItemRequest(text: string): { name: string; quantity: number; unit: string } | null {
  const quantityMatch = text.match(/\b(\d+)\s+([a-z][a-z\s-]*?)(?=\s+(?:and\s+)?(?:add|checkout|check out|order|to cart)\b|$)/i);
  if (quantityMatch) return { name: quantityMatch[2].trim().replace(/\bitems?$/i, '').trim(), quantity: Number(quantityMatch[1]), unit: 'items' };
  const named = text.match(/(?:search|find|add)(?:\s+for)?\s+([a-z][a-z\s-]*?)(?=\s+(?:and\s+)?(?:add|checkout|check out|order|to cart)\b|$)/i);
  return named ? { name: named[1].trim(), quantity: 1, unit: 'items' } : null;
}

function resultData(result: any): any { return result?.data ?? result; }
function firstAddressId(result: unknown): string { return String(resultData(result)?.addresses?.[0]?.id || ''); }

function selectProduct(result: unknown, desiredCount: number): SelectedItem | null {
  const data = resultData(result);
  const product = data?.products?.[0];
  const variant = product?.variants?.[0] ?? product?.variations?.[0] ?? product;
  const spinId = variant?.spinId ?? variant?.spin_id;
  if (!spinId) return null;
  const pack = String(variant.pack ?? variant.quantityDescription ?? '1 item');
  const packCount = Number(pack.match(/(\d+)\s*(?:pieces?|pcs?|items?)/i)?.[1] || 1);
  return { query: product?.name || variant?.name || '', productName: String(variant?.name ?? product?.name ?? 'Selected product'), spinId: String(spinId), pack, quantity: Math.max(1, Math.ceil(desiredCount / Math.max(1, packCount))), price: Number(variant?.price ?? variant?.finalPrice ?? 0) };
}

function preferredPayment(result: unknown): string {
  const data = resultData(result);
  const methods = data?.methods ?? data?.paymentMethods ?? data?.availablePaymentMethods ?? [];
  const normalized = methods.map((method: any) => typeof method === 'string' ? method : method.groupName || method.id || method.displayName);
  return normalized.find((method: string) => /^(COD|Cash)$/i.test(method)) || normalized[0] || 'COD';
}

function selectionSummary(item: SelectedItem): string { return `I selected ${item.productName} (${item.pack}) × ${item.quantity}. Say “add it” to update the cart.`; }
function cartSummary(state: ShoppingAgentState): string { const item = state.selectedItems[0]; return `Added ${item.productName} (${item.pack}) × ${item.quantity} to the developer cart. Say “checkout” when you want a refreshed order review.`; }
function checkoutReview(state: ShoppingAgentState): string {
  const data = resultData(state.cart); const pricing = data?.pricing ?? {}; const total = pricing.toPay ?? pricing.to_pay ?? data?.total ?? 'unavailable';
  const lines = state.selectedItems.map(item => `- ${item.productName} — ${item.pack} × ${item.quantity}`).join('\n');
  return `Developer checkout review\n\n${lines}\n\nDelivery address ID: ${state.addressId}\nPayment: ${preferredPayment(state.payment)}\nTotal: ₹${total}\n\nReply “yes, place the order” to confirm.`;
}
function summarizeOrder(result: unknown): string { const data = resultData(result); return `Instamart developer order placed successfully. Order ${data?.orderId || 'created'} is ${data?.status || 'confirmed'}.`; }

const CHAT_INSTRUCTIONS = `You are Tabby's Instamart developer assistant with the complete Instamart MCP catalogue.
Use tools for addresses, products, carts, coupons, payments, and orders. Never invent identifiers, prices, availability, totals, addresses, or order status.
For shopping, resolve an address, search every item, choose reasonable variants and quantities, update the cart, then refresh and summarize it.
Never call checkout until you showed a freshly read cart, delivery address, payment options, asked for confirmation, and the current user message explicitly confirms. Set confirmedByUser=true only then. A prior automation request is not confirmation.
Clearly label developer orders, stay concise, and report tool failures.`;
