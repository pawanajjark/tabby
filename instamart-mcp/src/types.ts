export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolClient {
  listTools(): Promise<McpToolDefinition[]>;
  callTool(name: string, arguments_: Record<string, unknown>): Promise<unknown>;
  close?(): Promise<void>;
}

export interface RecipeItem {
  name: string;
  quantity: number;
  unit: string;
}

export interface ProductMatch {
  ingredient: RecipeItem;
  productName: string;
  pack: string;
  quantity: number;
  spinId: string;
  price: number;
}

export interface CartPreparation {
  sessionId: string;
  addressId: string;
  deliveryAddress: string;
  matches: ProductMatch[];
  unavailable: RecipeItem[];
  cart: unknown;
  paymentMethod: string;
  expiresAt: number;
}
