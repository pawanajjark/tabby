// src/services/agentShopping.ts
import { AIProvider } from './aiProvider';
import { RoommateProfile } from './householdConfig';

export interface PantryItemData {
  id?: bigint;
  name: string;
  quantity: number;
  unit: string;
}

export interface ShoppingRecommendation {
  itemName: string;
  suggestedQuantity: number;
  unit: string;
  urgency: 'critical' | 'recommended' | 'optional';
  category: 'Produce' | 'Dairy & Protein' | 'Grains & Spices' | 'Household & Cleaning' | 'Snacks & Beverages';
  reason: string;
  matchedMeals: string[];
}

export interface ShoppingPlan {
  summary: string;
  generatedAt: string;
  items: ShoppingRecommendation[];
}

export class AgentShopping {
  /**
   * Agent 1: Generates smart restock recommendations based on current pantry items,
   * roommate cooking habits, and dietary restrictions.
   */
  static async generateShoppingPlan(
    pantryItems: PantryItemData[],
    roommates: RoommateProfile[]
  ): Promise<ShoppingPlan> {
    const pantrySummary = pantryItems.map(i => `${i.name}: ${i.quantity} ${i.unit}`).join(', ') || 'Pantry is currently empty';
    const roommateSummaries = roommates.map(r => 
      `${r.displayName} (Diet: ${r.dietaryTags.join(', ')} | Cooks: ${r.cookingHabits.join(', ')})`
    ).join('\n');

    // Attempt Gemini AI Generation if available
    if (AIProvider.hasApiKey()) {
      const prompt = `You are Tabby's Agent 1: Shopping Assistant.
Given the current pantry inventory and the household roommates' cooking habits and dietary restrictions, generate an intelligent grocery restock shopping list.

Current Pantry:
${pantrySummary}

Roommate Profiles:
${roommateSummaries}

Produce a JSON object with this exact structure:
{
  "summary": "Brief 1-2 sentence high-level overview of the shopping list rationale",
  "items": [
    {
      "itemName": "string",
      "suggestedQuantity": number,
      "unit": "string",
      "urgency": "critical" | "recommended" | "optional",
      "category": "Produce" | "Dairy & Protein" | "Grains & Spices" | "Household & Cleaning" | "Snacks & Beverages",
      "reason": "Why this is needed based on habits or low pantry stock",
      "matchedMeals": ["Meal name 1", "Meal name 2"]
    }
  ]
}`;

      const aiResult = await AIProvider.generateJson<{ summary: string; items: ShoppingRecommendation[] }>(
        prompt,
        'You are an expert grocery inventory and household meal planning assistant.'
      );

      if (aiResult && Array.isArray(aiResult.items) && aiResult.items.length > 0) {
        return {
          summary: aiResult.summary || 'Smart shopping suggestions curated for your household.',
          generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          items: aiResult.items,
        };
      }
    }

    // Heuristic Fallback Engine
    return this.generateHeuristicPlan(pantryItems, roommates);
  }

  private static generateHeuristicPlan(
    pantryItems: PantryItemData[],
    roommates: RoommateProfile[]
  ): ShoppingPlan {
    const pantryMap = new Map<string, number>();
    pantryItems.forEach(item => {
      pantryMap.set(item.name.toLowerCase().trim(), item.quantity);
    });

    const items: ShoppingRecommendation[] = [];
    const allHabits = roommates.flatMap(r => r.cookingHabits);
    const hasVegetarian = roommates.some(r => r.dietaryTags.includes('vegetarian') || r.dietaryTags.includes('vegan'));
    const hasVegan = roommates.some(r => r.dietaryTags.includes('vegan'));

    // Base pantry staple rules
    const staples: Array<{
      name: string;
      qty: number;
      unit: string;
      category: ShoppingRecommendation['category'];
      min: number;
      reason: string;
      meals: string[];
      dietCheck?: () => boolean;
    }> = [
      { name: 'onions', qty: 2, unit: 'kg', category: 'Produce', min: 1, reason: 'Essential base for cooking curries, pasta, and daily meals.', meals: ['Dal Tadka', 'Curry', 'Pasta'] },
      { name: 'tomatoes', qty: 1.5, unit: 'kg', category: 'Produce', min: 1, reason: 'Key ingredient for sauces, gravies, and fresh salads.', meals: ['Pasta', 'Curry', 'Salad'] },
      { name: 'garlic & ginger', qty: 250, unit: 'g', category: 'Produce', min: 100, reason: 'Aromatic foundation for household recipes.', meals: ['Stir Fry', 'Curry', 'Dal'] },
      { name: 'olive oil / cooking oil', qty: 1, unit: 'bottle', category: 'Grains & Spices', min: 1, reason: 'Daily cooking oil is running low or needed for regular meals.', meals: ['All household meals'] },
      { name: 'rice / pasta', qty: 2, unit: 'kg', category: 'Grains & Spices', min: 1, reason: 'Carbohydrate staple requested across usual roommate meals.', meals: ['Fried Rice', 'Pasta', 'Dal Rice'] },
      { name: 'lentils / dal', qty: 1, unit: 'kg', category: 'Grains & Spices', min: 1, reason: 'Protein-rich staple aligned with roommate dietary habits.', meals: ['Dal Tadka', 'Khichdi'] },
    ];

    if (!hasVegan) {
      staples.push({
        name: 'milk / curd',
        qty: 2,
        unit: 'litres',
        category: 'Dairy & Protein',
        min: 1,
        reason: 'Daily beverage, tea/coffee, and cooking dairy need.',
        meals: ['Morning Chai/Coffee', 'Paneer Curry'],
      });
      if (hasVegetarian) {
        staples.push({
          name: 'paneer / tofu',
          qty: 400,
          unit: 'g',
          category: 'Dairy & Protein',
          min: 200,
          reason: 'High-protein vegetarian option for frequent household dinners.',
          meals: ['Paneer Butter Masala', 'Tofu Stir Fry'],
        });
      }
    } else {
      staples.push({
        name: 'oat / almond milk',
        qty: 2,
        unit: 'litres',
        category: 'Dairy & Protein',
        min: 1,
        reason: 'Plant-based milk for vegan roommate preferences.',
        meals: ['Oatmeal', 'Coffee/Tea'],
      });
      staples.push({
        name: 'firm tofu',
        qty: 500,
        unit: 'g',
        category: 'Dairy & Protein',
        min: 200,
        reason: 'High protein plant-based meal staple.',
        meals: ['Tofu Stir Fry', 'Tofu Scramble'],
      });
    }

    // Check staple levels vs pantry
    staples.forEach(staple => {
      const match = Array.from(pantryMap.entries()).find(([k]) => k.includes(staple.name.split('/')[0].trim().toLowerCase()));
      const currentQty = match ? match[1] : 0;
      
      if (currentQty <= 0) {
        items.push({
          itemName: staple.name,
          suggestedQuantity: staple.qty,
          unit: staple.unit,
          urgency: 'critical',
          category: staple.category,
          reason: staple.reason,
          matchedMeals: staple.meals,
        });
      } else if (currentQty < staple.min) {
        items.push({
          itemName: staple.name,
          suggestedQuantity: staple.qty,
          unit: staple.unit,
          urgency: 'recommended',
          category: staple.category,
          reason: `Stock is low (${currentQty} remaining). Needed for upcoming meals.`,
          matchedMeals: staple.meals,
        });
      }
    });

    // Custom recipe habit additions
    allHabits.forEach(habit => {
      const habitLower = habit.toLowerCase();
      if (habitLower.includes('biryani') && !pantryMap.has('biryani masala') && !pantryMap.has('basmati rice')) {
        items.push({
          itemName: 'Basmati Rice & Biryani Spices',
          suggestedQuantity: 1,
          unit: 'pack',
          urgency: 'recommended',
          category: 'Grains & Spices',
          reason: `Needed for frequent dish: ${habit}`,
          matchedMeals: [habit],
        });
      }
      if (habitLower.includes('pasta') && !pantryMap.has('parmesan') && !pantryMap.has('pasta sauce')) {
        items.push({
          itemName: 'Pasta Sauce & Herbs (Oregano/Basil)',
          suggestedQuantity: 1,
          unit: 'jar',
          urgency: 'optional',
          category: 'Grains & Spices',
          reason: `Flavors for roommate's ${habit}`,
          matchedMeals: [habit],
        });
      }
    });

    return {
      summary: `Tabby analyzed ${pantryItems.length} pantry items against ${roommates.length} roommate preferences (${allHabits.length} favorite recipes).`,
      generatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      items: items.length > 0 ? items : [
        {
          itemName: 'Fresh Herbs & Seasonal Fruits',
          suggestedQuantity: 1,
          unit: 'bunch',
          urgency: 'optional',
          category: 'Produce',
          reason: 'Pantry is well-stocked! Adding fresh garnish for current meals.',
          matchedMeals: allHabits.slice(0, 2),
        }
      ],
    };
  }
}
