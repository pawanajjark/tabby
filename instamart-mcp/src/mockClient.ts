import type { McpToolDefinition, ToolClient } from './types.js';
import { INSTAMART_TOOL_SCHEMAS, validateToolArguments } from './toolSchemas.js';

const toolNames = [
  'create_address', 'delete_address', 'get_addresses', 'search_products', 'your_go_to_items',
  'apply_coupon', 'clear_cart', 'get_cart', 'list_coupons', 'update_cart',
  'check_payment_status', 'confirm_order', 'get_payment_options', 'checkout',
  'get_delivery_status', 'get_order_details', 'get_orders', 'track_order', 'report_error',
] as const;

const catalog = [
  ['tomato', 'Fresh Tomato', '500 g', 32], ['onion', 'Fresh Onion', '1 kg', 48],
  ['garlic', 'Fresh Garlic', '200 g', 42], ['ginger', 'Fresh Ginger', '200 g', 35],
  ['rice', 'India Gate Everyday Rice', '1 kg', 115], ['dal', 'Tata Sampann Toor Dal', '500 g', 92],
  ['lentil', 'Tata Sampann Toor Dal', '500 g', 92], ['pasta', 'Weikfield Penne Pasta', '500 g', 88],
  ['spaghetti', 'Borges Spaghetti', '500 g', 145], ['olive oil', 'Figaro Olive Oil', '200 ml', 249],
  ['cooking oil', 'Fortune Sunflower Oil', '1 L', 139], ['salt', 'Tata Salt', '1 kg', 28],
  ['chili', 'Keya Chilli Flakes', '40 g', 85], ['pepper', 'Everest Black Pepper', '50 g', 99],
  ['turmeric', 'Everest Turmeric Powder', '100 g', 42], ['cumin', 'Tata Sampann Cumin', '100 g', 66],
  ['milk', 'Amul Taaza Milk', '500 ml', 29], ['bread', 'English Oven Brown Bread', '400 g', 55],
  ['egg', 'Fresh Eggs', '6 pieces', 54], ['potato', 'Fresh Potato', '1 kg', 44],
  ['vegetable', 'Fresh Mixed Vegetables', '500 g', 85], ['yogurt', 'Fresh Plain Yogurt', '400 g', 70],
  ['biryani masala', 'Biryani Masala', '50 g', 62], ['chicken', 'Fresh Chicken Curry Cut', '500 g', 185],
  ['mutton', 'Fresh Mutton Curry Cut', '500 g', 399],
  ['paneer', 'Fresh Malai Paneer', '200 g', 95], ['coriander', 'Coriander Powder', '100 g', 48],
] as const;

type CartLine = { spinId: string; quantity: number; name: string; pack: string; price: number };

export class MockInstamartClient implements ToolClient {
  private cart: CartLine[] = [];
  private coupon = '';

  async listTools(): Promise<McpToolDefinition[]> {
    return INSTAMART_TOOL_SCHEMAS;
  }

  async callTool(name: string, args: Record<string, any>): Promise<unknown> {
    if (!toolNames.includes(name as typeof toolNames[number])) throw new Error(`Unknown Instamart tool: ${name}`);
    validateToolArguments(name, args);
    if (name === 'get_addresses') return success({ addresses: [{ id: 'dev-home', addressLine: 'Developer Home, Bengaluru', addressTag: 'Home' }] });
    if (name === 'search_products') {
      const query = String(args.query || '').toLowerCase();
      const terms = query.split(/\s*(?:\/|&|,|\bor\b)\s*/).filter(Boolean);
      const rows = catalog.filter(row => terms.some(term => row[0].includes(term) || term.includes(row[0])));
      return success({ products: rows.map(([key, productName, pack, price]) => ({
        name: productName,
        variants: [{ spinId: `dev-${key.replace(/\s+/g, '-')}`, name: productName, pack, price }],
      })) });
    }
    if (name === 'update_cart') {
      this.cart = (args.items || []).map((item: { spinId: string; quantity: number }) => {
        const key = item.spinId.replace(/^dev-/, '').replace(/-/g, ' ');
        const row = catalog.find(candidate => candidate[0] === key) || [key, key, '1 pack', 50];
        return { spinId: item.spinId, quantity: item.quantity, name: row[1], pack: row[2], price: row[3] };
      });
      return success(this.cartData());
    }
    if (name === 'get_cart') return success(this.cartData());
    if (name === 'clear_cart') { this.cart = []; this.coupon = ''; return success({ verified: true }); }
    if (name === 'list_coupons') return success({ coupons: [{ code: 'DEV10', applicable: this.cart.length > 0, discount: 10 }] });
    if (name === 'apply_coupon') { this.coupon = String(args.couponCode || ''); return success(this.cartData()); }
    if (name === 'get_payment_options') return success({ methods: [{ id: 'COD', displayName: 'Cash on delivery', enabled: true }] });
    if (name === 'checkout') return success({ orderId: `DEV-${Date.now()}`, status: 'CONFIRMED', paymentMethod: args.paymentMethod || 'COD', addressId: args.addressId, cartTotal: this.total() }, 'Instamart developer order placed successfully');
    if (name === 'get_orders') return success({ orders: [] });
    if (name === 'track_order' || name === 'get_delivery_status') return success({ status: 'DEVELOPER_ORDER', etaMinutes: 10 });
    if (name === 'get_order_details') return success({ orderId: args.orderId, status: 'DEVELOPER_ORDER' });
    if (name === 'create_address') return success({ id: 'dev-created-address', ...args });
    if (name === 'delete_address') return success({ deleted: true });
    if (name === 'your_go_to_items') return success({ products: [] });
    if (name === 'check_payment_status') return success({ status: 'SUCCESS', terminal: true });
    if (name === 'confirm_order') return success({ status: 'CONFIRMED' });
    return success({ acknowledged: true });
  }

  private total(): number {
    const subtotal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return Math.max(0, subtotal - (this.coupon ? 10 : 0));
  }

  private cartData() {
    const subtotal = this.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return {
      items: this.cart,
      pricing: { itemTotal: subtotal, couponDiscount: this.coupon ? 10 : 0, toPay: this.total(), currency: 'INR' },
      couponApplied: this.coupon || null,
      availablePaymentMethods: ['COD'],
    };
  }
}

function success(data: unknown, message?: string) {
  return { success: true, data, message };
}
