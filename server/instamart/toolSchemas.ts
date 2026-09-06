// Instamart MCP schemas hosted by the parent Tabby service.
import type { McpToolDefinition } from './types.js';

const object = (properties: Record<string, unknown>, required: string[] = []): Record<string, unknown> => ({
  type: 'object', properties, required, additionalProperties: false,
});
const string = (description: string) => ({ type: 'string', description });

export const INSTAMART_TOOL_SCHEMAS: McpToolDefinition[] = [
  { name: 'create_address', description: 'Create a saved delivery address. Requires complete user-provided address details; never invent them.', inputSchema: object({ addressLine: string('Full address'), label: string('Address label') }, ['addressLine']) },
  { name: 'delete_address', description: 'Delete a saved address by exact ID.', inputSchema: object({ addressId: string('ID from get_addresses') }, ['addressId']) },
  { name: 'get_addresses', description: 'List saved delivery addresses. Call before product search or checkout.', inputSchema: object({}) },
  { name: 'search_products', description: 'Search products available at a saved address. Results contain variants; use a variant spinId in update_cart.', inputSchema: object({ addressId: string('ID from get_addresses'), query: string('Product name or concise query') }, ['addressId', 'query']) },
  { name: 'your_go_to_items', description: 'Get frequently ordered products for an address.', inputSchema: object({ addressId: string('ID from get_addresses') }, ['addressId']) },
  { name: 'apply_coupon', description: 'Apply an exact applicable coupon code to the current cart.', inputSchema: object({ couponCode: string('Code from list_coupons') }, ['couponCode']) },
  { name: 'clear_cart', description: 'Remove every item from the Instamart cart.', inputSchema: object({}) },
  { name: 'get_cart', description: 'Read the current cart and live bill. Pass the selected address when available.', inputSchema: object({ addressId: string('ID from get_addresses') }) },
  { name: 'list_coupons', description: 'List coupons applicable to the current cart.', inputSchema: object({}) },
  { name: 'update_cart', description: 'Replace the entire grocery cart. Each item must use an exact search-result spinId and positive integer quantity.', inputSchema: object({ items: { type: 'array', minItems: 1, items: object({ spinId: string('Variant spinId from search_products'), quantity: { type: 'integer', minimum: 1 } }, ['spinId', 'quantity']) } }, ['items']) },
  { name: 'check_payment_status', description: 'Check an in-flight payment once.', inputSchema: object({ transactionId: string('Transaction ID returned by checkout') }, ['transactionId']) },
  { name: 'confirm_order', description: 'Confirm an order only after payment succeeds.', inputSchema: object({ orderId: string('Order ID'), transactionId: string('Successful transaction ID') }, ['orderId']) },
  { name: 'get_payment_options', description: 'Read live payment methods for the current cart.', inputSchema: object({}) },
  { name: 'checkout', description: 'Place the current order. Requires a refreshed cart/address/payment review and explicit confirmation in a new user message.', inputSchema: object({ addressId: string('Selected saved address ID'), paymentMethod: string('Exact available payment group'), intentApp: string('Exact UPI app ID when using UPI'), generateUPIQR: { type: 'boolean' } }, ['addressId']) },
  { name: 'get_delivery_status', description: 'Read the current delivery state for an order.', inputSchema: object({ orderId: string('Order ID') }, ['orderId']) },
  { name: 'get_order_details', description: 'Read full details for an exact order ID.', inputSchema: object({ orderId: string('Order ID') }, ['orderId']) },
  { name: 'get_orders', description: 'List Instamart order history.', inputSchema: object({}) },
  { name: 'track_order', description: 'Track an active order by exact order ID.', inputSchema: object({ orderId: string('Order ID') }, ['orderId']) },
  { name: 'report_error', description: 'Prepare a support error report for a failed tool call.', inputSchema: object({ tool: string('Tool that failed'), message: string('Failure details') }, ['tool', 'message']) },
];

export function validateToolArguments(name: string, args: Record<string, unknown>): void {
  const definition = INSTAMART_TOOL_SCHEMAS.find(tool => tool.name === name);
  if (!definition) throw new Error(`Unknown Instamart tool: ${name}`);
  validateObject(args, definition.inputSchema, name);
}

function validateObject(value: unknown, schema: Record<string, any>, path: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} arguments must be an object.`);
  const record = value as Record<string, unknown>;
  for (const required of schema.required || []) if (!(required in record)) throw new Error(`${path}.${required} is required.`);
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(record)) if (!(key in (schema.properties || {}))) throw new Error(`${path}.${key} is not a supported argument.`);
  }
  for (const [key, child] of Object.entries<any>(schema.properties || {})) {
    if (!(key in record)) continue;
    const candidate = record[key];
    if (child.type === 'string' && (typeof candidate !== 'string' || !candidate.trim())) throw new Error(`${path}.${key} must be a non-empty string.`);
    if (child.type === 'boolean' && typeof candidate !== 'boolean') throw new Error(`${path}.${key} must be boolean.`);
    if (child.type === 'integer' && (!Number.isInteger(candidate) || Number(candidate) < (child.minimum || 0))) throw new Error(`${path}.${key} must be a positive integer.`);
    if (child.type === 'array') {
      if (!Array.isArray(candidate) || candidate.length < (child.minItems || 0)) throw new Error(`${path}.${key} must contain at least one item.`);
      candidate.forEach((item, index) => validateObject(item, child.items, `${path}.${key}[${index}]`));
    }
  }
}
