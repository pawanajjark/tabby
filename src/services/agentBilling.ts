// src/services/agentBilling.ts
import { AIProvider } from './aiProvider';
import { RoommateProfile, SplitRule } from './householdConfig';

export type ItemCategory = 'veg' | 'non_veg' | 'dairy' | 'alcohol' | 'household_utility' | 'personal' | 'general';

export interface BillLineItem {
  id: string;
  name: string;
  pricePaise: bigint; // in paise (e.g. ₹150.00 = 15000n)
  category: ItemCategory;
  assignedRoommates: string[]; // identityHex array of who shares this line item
  excludedRoommates: string[]; // identityHex array of who is exempt based on rules
  exemptionReasons: Record<string, string>; // identityHex -> explanation
}

export interface SplitResult {
  billTitle: string;
  totalAmountPaise: bigint;
  taxOrDiscountPaise: bigint;
  lineItems: BillLineItem[];
  roommateShares: Array<{
    identityHex: string;
    displayName: string;
    amountPaise: bigint;
    itemCount: number;
    breakdownNotes: string[];
    isExemptFromItems: string[];
  }>;
}

export class AgentBilling {
  /**
   * Agent 3: Parses receipt images or text and calculates fair splits based on household rules.
   */
  static async parseAndSplitBill(
    input: { text?: string; imageBase64?: string; title?: string },
    roommates: RoommateProfile[],
    rules: SplitRule[],
  ): Promise<SplitResult> {
    const rawText = input.text?.trim() || '';
    const title = input.title?.trim() || 'Household expense';

    if (!rawText && !input.imageBase64) {
      throw new Error('Add receipt text or upload a receipt image before calculating the split.');
    }

    if (input.imageBase64 && !AIProvider.hasApiKey() && !rawText) {
      throw new Error('Receipt image analysis requires an OpenAI API key. Add a key or paste the receipt items as text.');
    }

    // 1. Try multimodal / LLM receipt parsing if available
    if (AIProvider.hasApiKey() && (input.imageBase64 || rawText)) {
      const prompt = `You are Tabby's Agent 3: Billing & Receipt Assistant.
Analyze this receipt / bill text / image.
Extract each line item with its exact name, total price in INR (Rupees), and categorize it strictly into one of:
- "non_veg" (chicken, meat, fish, prawns, egg dishes if non-veg, bacon, etc.)
- "veg" (vegetables, tofu, paneer, vegetarian dishes, fruits, bread, rice)
- "dairy" (milk, cheese, yogurt, butter, cream)
- "alcohol" (beer, wine, spirits, cocktails)
- "household_utility" (cleaning supplies, electricity, wifi, toilet paper, detergent)
- "general" (mixed grocery or snacks)

Bill text:
${rawText}

Return a valid JSON object with:
{
  "title": "Short descriptive bill title",
  "taxOrDiscountRupees": 0,
  "items": [
    {
      "name": "Item description",
      "priceRupees": 250.50,
      "category": "veg" | "non_veg" | "dairy" | "alcohol" | "household_utility" | "general"
    }
  ]
}`;

      const parsed = await AIProvider.generateJson<{
        title?: string;
        taxOrDiscountRupees?: number;
        items: Array<{ name: string; priceRupees: number; category: ItemCategory }>;
      }>(prompt, 'You are an accurate billing and receipt parsing agent.', input.imageBase64);

      const validItems = parsed?.items?.filter(item =>
        typeof item.name === 'string' &&
        item.name.trim().length > 0 &&
        Number.isFinite(item.priceRupees) &&
        item.priceRupees > 0
      );

      if (parsed && validItems && validItems.length > 0) {
        return this.calculateSplits(
          parsed.title || title,
          validItems.map((it, idx) => ({
            id: `item_${idx + 1}`,
            name: it.name,
            pricePaise: BigInt(Math.round(it.priceRupees * 100)),
            category: it.category || 'general',
          })),
          BigInt(Math.round((parsed.taxOrDiscountRupees || 0) * 100)),
          roommates,
          rules
        );
      }
    }

    if (!rawText) {
      throw new Error('The receipt image could not be read. Paste the receipt items as text and try again.');
    }

    // 2. Deterministic text parser
    const heuristicItems = this.parseRawReceiptText(rawText);
    return this.calculateSplits(
      title,
      heuristicItems.items,
      heuristicItems.taxOrDiscountPaise,
      roommates,
      rules
    );
  }

  /**
   * Applies config rules (e.g. vegetarians excluded from non-veg) to itemized bills
   */
  static calculateSplits(
    billTitle: string,
    rawItems: Array<{ id: string; name: string; pricePaise: bigint; category: ItemCategory }>,
    taxOrDiscountPaise: bigint,
    roommates: RoommateProfile[],
    rules: SplitRule[]
  ): SplitResult {
    if (roommates.length === 0) {
      throw new Error('No roommates provided for split calculation.');
    }

    // Map active exemption rules
    const nonVegExempt = rules.find(r => r.id === 'veg_no_meat')?.enabled ?? true;
    const dairyExempt = rules.find(r => r.id === 'vegan_no_dairy')?.enabled ?? true;
    const alcoholExempt = rules.find(r => r.id === 'no_alcohol')?.enabled ?? true;

    const lineItems: BillLineItem[] = [];
    const roommateItemCosts: Record<string, bigint> = {};
    const roommateExemptions: Record<string, string[]> = {};
    const roommateBreakdowns: Record<string, string[]> = {};

    roommates.forEach(r => {
      roommateItemCosts[r.identityHex] = 0n;
      roommateExemptions[r.identityHex] = [];
      roommateBreakdowns[r.identityHex] = [];
    });

    let itemsTotalPaise = 0n;

    rawItems.forEach(item => {
      itemsTotalPaise += item.pricePaise;
      const assigned: string[] = [];
      const excluded: string[] = [];
      const reasons: Record<string, string> = {};

      roommates.forEach(rm => {
        let isExempt = false;
        let reason = '';

        // Rule 1: Non-veg exemption for vegetarians / vegans
        if (item.category === 'non_veg' && nonVegExempt) {
          if (rm.dietaryTags.includes('vegetarian') || rm.dietaryTags.includes('vegan') || rm.dietaryTags.includes('jain') || rm.customSplitExclusions.includes('non_veg')) {
            isExempt = true;
            reason = `Exempt: ${rm.displayName} is ${rm.dietaryTags.join('/')} (Non-Veg rule)`;
          }
        }

        // Rule 2: Dairy exemption for vegans / lactose intolerant
        if (item.category === 'dairy' && dairyExempt) {
          if (rm.dietaryTags.includes('vegan') || rm.dietaryTags.includes('lactose_intolerant') || rm.customSplitExclusions.includes('dairy')) {
            isExempt = true;
            reason = `Exempt: ${rm.displayName} does not consume dairy`;
          }
        }

        // Rule 3: Alcohol exemption
        if (item.category === 'alcohol' && alcoholExempt) {
          if (rm.dietaryTags.includes('no_alcohol') || rm.customSplitExclusions.includes('alcohol')) {
            isExempt = true;
            reason = `Exempt: ${rm.displayName} does not drink alcohol`;
          }
        }

        if (isExempt) {
          excluded.push(rm.identityHex);
          reasons[rm.identityHex] = reason;
          roommateExemptions[rm.identityHex].push(item.name);
        } else {
          assigned.push(rm.identityHex);
        }
      });

      // If everyone was somehow excluded, split among everyone equally as fallback
      const payers = assigned.length > 0 ? assigned : roommates.map(r => r.identityHex);
      const share = item.pricePaise / BigInt(payers.length);
      const remainder = item.pricePaise % BigInt(payers.length);

      payers.forEach((pid, idx) => {
        const amt = share + (idx === 0 ? remainder : 0n);
        roommateItemCosts[pid] = (roommateItemCosts[pid] || 0n) + amt;
        const rm = roommates.find(r => r.identityHex === pid);
        if (rm) {
          roommateBreakdowns[pid].push(`${item.name}: ₹${(Number(amt) / 100).toFixed(2)} (${payers.length}-way split)`);
        }
      });

      lineItems.push({
        id: item.id,
        name: item.name,
        pricePaise: item.pricePaise,
        category: item.category,
        assignedRoommates: payers,
        excludedRoommates: excluded,
        exemptionReasons: reasons,
      });
    });

    const finalTotalPaise = itemsTotalPaise + taxOrDiscountPaise;

    // Distribute tax / service charge proportionally according to item consumption
    let distributedAdjustment = 0n;
    const roommateShares = roommates.map((rm, index) => {
      const rawCost = roommateItemCosts[rm.identityHex] || 0n;
      let finalCost = rawCost;

      if (itemsTotalPaise > 0n && taxOrDiscountPaise !== 0n) {
        const isLastRoommate = index === roommates.length - 1;
        const taxShare = isLastRoommate
          ? taxOrDiscountPaise - distributedAdjustment
          : (taxOrDiscountPaise * rawCost) / itemsTotalPaise;
        distributedAdjustment += taxShare;
        finalCost += taxShare;
      }

      return {
        identityHex: rm.identityHex,
        displayName: rm.displayName,
        amountPaise: finalCost,
        itemCount: lineItems.filter(l => l.assignedRoommates.includes(rm.identityHex)).length,
        breakdownNotes: roommateBreakdowns[rm.identityHex] || [],
        isExemptFromItems: roommateExemptions[rm.identityHex] || [],
      };
    });

    return {
      billTitle,
      totalAmountPaise: finalTotalPaise,
      taxOrDiscountPaise,
      lineItems,
      roommateShares,
    };
  }

  /**
   * Fast rule-based parser for text receipts
   */
  private static parseRawReceiptText(rawText: string): {
    items: Array<{ id: string; name: string; pricePaise: bigint; category: ItemCategory }>;
    taxOrDiscountPaise: bigint;
  } {
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const items: Array<{ id: string; name: string; pricePaise: bigint; category: ItemCategory }> = [];
    let taxOrDiscountPaise = 0n;

    const nonVegKeywords = ['chicken', 'mutton', 'meat', 'fish', 'prawn', 'egg', 'bacon', 'beef', 'pork', 'wings', 'biryani non-veg', 'pepperoni', 'kebab'];
    const dairyKeywords = ['milk', 'cheese', 'paneer', 'butter', 'curd', 'yogurt', 'cream', 'ghee'];
    const alcoholKeywords = ['beer', 'wine', 'vodka', 'whiskey', 'rum', 'cocktail', 'gin', 'tequila'];
    const utilityKeywords = ['wifi', 'electricity', 'detergent', 'soap', 'cleaner', 'towel', 'rent', 'utility', 'trash', 'paper'];

    const detectCategory = (name: string): ItemCategory => {
      const lower = name.toLowerCase();
      if (nonVegKeywords.some(kw => lower.includes(kw))) return 'non_veg';
      if (alcoholKeywords.some(kw => lower.includes(kw))) return 'alcohol';
      if (dairyKeywords.some(kw => lower.includes(kw))) return 'dairy';
      if (utilityKeywords.some(kw => lower.includes(kw))) return 'household_utility';
      return 'veg';
    };

    let itemIdx = 1;
    for (const line of lines) {
      // Look for lines like "Butter Chicken - 350", "Paneer Tikka Rs 240", "1x Milk 60", "Total ₹1200"
      const priceMatch = line.match(/(?:[₹$]|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:[₹$]|rs\.?|inr)?$/i)
        || line.match(/([\d,]+(?:\.\d{1,2})?)/);

      if (priceMatch) {
        const rawAmount = parseFloat(priceMatch[1].replace(/,/g, ''));
        if (isNaN(rawAmount) || rawAmount <= 0) continue;

        const namePart = line.replace(priceMatch[0], '').replace(/[-–:—]/g, ' ').trim() || `Item ${itemIdx}`;

        if (/tax|gst|vat|service charge|tip/i.test(namePart)) {
          taxOrDiscountPaise += BigInt(Math.round(rawAmount * 100));
        } else if (/discount|coupon|promo/i.test(namePart)) {
          taxOrDiscountPaise -= BigInt(Math.round(rawAmount * 100));
        } else if (!/total|subtotal|grand total|net amount/i.test(namePart)) {
          items.push({
            id: `item_${itemIdx++}`,
            name: namePart,
            pricePaise: BigInt(Math.round(rawAmount * 100)),
            category: detectCategory(namePart),
          });
        }
      }
    }

    if (items.length === 0) {
      throw new Error('No priced receipt lines were found. Use one item per line, such as "Rice - 450".');
    }

    return { items, taxOrDiscountPaise };
  }
}
