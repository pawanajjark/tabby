// src/services/agentCooking.ts
import { AIProvider } from './aiProvider';
import { RoommateProfile } from './householdConfig';
import { PantryItemData } from './agentShopping';

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  inPantry: boolean;
  pantryQuantity?: number;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  servings: number;
  difficulty: 'Easy' | 'Medium' | 'Chef';
  dietaryTags: string[]; // e.g. ['Vegetarian', 'Gluten-Free', 'High-Protein']
  compatibleRoommates: string[]; // Roommate names this recipe satisfies
  ingredients: RecipeIngredient[];
  missingCount: number;
  instructions: string[];
  tips: string;
}

export interface CookingPlan {
  headline: string;
  recipes: Recipe[];
}

export class AgentCooking {
  /**
   * Agent 2: Generates recipes tailored to current pantry inventory,
   * roommate dietary rules, and frequent cooking habits.
   */
  static async generateRecipes(
    pantryItems: PantryItemData[],
    roommates: RoommateProfile[]
  ): Promise<CookingPlan> {
    const pantrySummary = pantryItems.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ') || 'Empty pantry';
    const roommateProfilesText = roommates.map(r => 
      `${r.displayName}: Diets=[${r.dietaryTags.join(', ')}], Habits=[${r.cookingHabits.join(', ')}]`
    ).join('\n');

    if (AIProvider.hasApiKey()) {
      const prompt = `You are Tabby's Agent 2: Cooking Assistant.
Analyze the current pantry inventory, the roommates' dietary preferences, and their frequent home-cooked dishes.
Generate 3 to 4 realistic, appetizing recipes that maximize the use of available pantry items and strictly adhere to the roommates' dietary constraints.

Current Pantry Stock:
${pantrySummary}

Roommates:
${roommateProfilesText}

Provide output as a valid JSON object matching this schema:
{
  "headline": "A short summary of tonight's cooking possibilities",
  "recipes": [
    {
      "id": "unique_string",
      "title": "Recipe Name",
      "description": "Appetizing 1-2 sentence description",
      "prepTimeMinutes": 10,
      "cookTimeMinutes": 20,
      "servings": 2,
      "difficulty": "Easy" | "Medium" | "Chef",
      "dietaryTags": ["Vegetarian", "Vegan", "High-Protein", etc.],
      "compatibleRoommates": ["Name 1", "Name 2"],
      "ingredients": [
        {
          "name": "ingredient name",
          "quantity": 1,
          "unit": "cup/items/g",
          "inPantry": true
        }
      ],
      "missingCount": 0,
      "instructions": ["Step 1...", "Step 2..."],
      "tips": "Chef tip for elevating flavor"
    }
  ]
}`;

      const aiResult = await AIProvider.generateJson<CookingPlan>(
        prompt,
        'You are an expert chef who excels at zero-waste cooking, matching recipes to available pantry ingredients and dietary requirements.'
      );

      if (aiResult && Array.isArray(aiResult.recipes) && aiResult.recipes.length > 0) {
        return aiResult;
      }
    }

    return this.generateHeuristicRecipes(pantryItems, roommates);
  }

  private static generateHeuristicRecipes(
    pantryItems: PantryItemData[],
    roommates: RoommateProfile[]
  ): CookingPlan {
    const pantryNames = pantryItems.map(p => p.name.toLowerCase().trim());
    const has = (name: string) => pantryNames.some(p => p.includes(name.toLowerCase()));
    const getQty = (name: string) => {
      const item = pantryItems.find(p => p.name.toLowerCase().includes(name.toLowerCase()));
      return item ? item.quantity : 0;
    };

    const hasVegetarian = roommates.some(r => r.dietaryTags.includes('vegetarian') || r.dietaryTags.includes('vegan'));
    const isRoommateSafe = (tags: string[], roommate: RoommateProfile) => {
      if (roommate.dietaryTags.includes('vegetarian') && tags.includes('Non-Veg')) return false;
      if (roommate.dietaryTags.includes('vegan') && (tags.includes('Non-Veg') || tags.includes('Dairy'))) return false;
      if (roommate.dietaryTags.includes('lactose_intolerant') && tags.includes('Dairy')) return false;
      return true;
    };

    const templateRecipes: Recipe[] = [
      {
        id: 'garlic_butter_pasta',
        title: 'Aglio e Olio Pasta with Sautéed Veggies',
        description: 'Classic, comforting Italian pasta tossed in fragrant garlic oil with fresh chili flakes and herbs.',
        prepTimeMinutes: 5,
        cookTimeMinutes: 12,
        servings: roommates.length || 2,
        difficulty: 'Easy',
        dietaryTags: ['Vegetarian', 'Quick 15-Min', 'Comfort Food'],
        compatibleRoommates: [],
        ingredients: [
          { name: 'pasta', quantity: 200, unit: 'g', inPantry: has('pasta') || has('spaghetti') || has('penne'), pantryQuantity: getQty('pasta') },
          { name: 'garlic', quantity: 4, unit: 'cloves', inPantry: has('garlic'), pantryQuantity: getQty('garlic') },
          { name: 'olive oil / cooking oil', quantity: 2, unit: 'tbsp', inPantry: has('oil'), pantryQuantity: getQty('oil') },
          { name: 'chili flakes / pepper', quantity: 1, unit: 'tsp', inPantry: has('chili') || has('pepper') || has('spice'), pantryQuantity: 1 },
          { name: 'salt', quantity: 1, unit: 'pinch', inPantry: true, pantryQuantity: 1 },
        ],
        missingCount: 0,
        instructions: [
          'Boil pasta in salted water until al dente (about 8-10 mins). Reserve 1/2 cup pasta water.',
          'In a wide skillet, heat oil over low-medium heat and gently sauté minced garlic until golden and fragrant.',
          'Toss the drained pasta into the garlic oil with a splash of reserved pasta water.',
          'Garnish with chili flakes and fresh herbs. Serve hot immediately!',
        ],
        tips: 'Emulsifying the starchy pasta water with garlic oil creates a silky sauce without cream.',
      },
      {
        id: 'homestyle_dal_tadka',
        title: 'Comforting Homestyle Dal Tadka & Rice',
        description: 'Warm, protein-rich yellow lentils tempered with cumin, mustard seeds, garlic, and golden onions.',
        prepTimeMinutes: 10,
        cookTimeMinutes: 20,
        servings: roommates.length || 2,
        difficulty: 'Easy',
        dietaryTags: ['Vegetarian', 'High-Protein', 'Gluten-Free'],
        compatibleRoommates: [],
        ingredients: [
          { name: 'lentils / dal', quantity: 1, unit: 'cup', inPantry: has('dal') || has('lentil'), pantryQuantity: getQty('dal') },
          { name: 'onions', quantity: 1, unit: 'medium', inPantry: has('onion'), pantryQuantity: getQty('onion') },
          { name: 'tomatoes', quantity: 1, unit: 'medium', inPantry: has('tomato'), pantryQuantity: getQty('tomato') },
          { name: 'garlic & ginger', quantity: 1, unit: 'tbsp', inPantry: has('garlic') || has('ginger'), pantryQuantity: getQty('garlic') },
          { name: 'turmeric & cumin', quantity: 1, unit: 'tsp', inPantry: has('turmeric') || has('cumin') || has('spice'), pantryQuantity: 1 },
          { name: 'rice', quantity: 1, unit: 'cup', inPantry: has('rice'), pantryQuantity: getQty('rice') },
        ],
        missingCount: 0,
        instructions: [
          'Wash and pressure cook or boil lentils with water, salt, and turmeric until soft.',
          'In a pan, heat 1 tbsp oil or ghee, add cumin seeds, chopped onions, and sauté until golden.',
          'Add garlic, ginger, and chopped tomatoes; cook until soft.',
          'Pour the tempering (tadka) over the cooked dal, stir gently, and simmer for 3 minutes.',
          'Serve with freshly steamed rice!',
        ],
        tips: 'A pinch of roasted cumin on top adds an authentic restaurant-style aroma.',
      },
      {
        id: 'crispy_fried_rice',
        title: 'Golden Pantry Fried Rice',
        description: 'Flavorful stir-fried rice loaded with aromatic garlic, crunchy veggies, and savory seasonings.',
        prepTimeMinutes: 5,
        cookTimeMinutes: 10,
        servings: roommates.length || 2,
        difficulty: 'Easy',
        dietaryTags: ['Vegetarian', 'Zero-Waste', 'Quick 15-Min'],
        compatibleRoommates: [],
        ingredients: [
          { name: 'cooked rice', quantity: 2, unit: 'cups', inPantry: has('rice'), pantryQuantity: getQty('rice') },
          { name: 'onions / scallions', quantity: 1, unit: 'item', inPantry: has('onion'), pantryQuantity: getQty('onion') },
          { name: 'vegetables (carrots/peas/capsicum)', quantity: 1, unit: 'cup', inPantry: has('vegetable') || has('carrot') || has('peas') || has('tomato'), pantryQuantity: 1 },
          { name: 'soy sauce / spices', quantity: 1, unit: 'tbsp', inPantry: has('sauce') || has('spice') || has('salt'), pantryQuantity: 1 },
          { name: 'cooking oil', quantity: 1, unit: 'tbsp', inPantry: has('oil'), pantryQuantity: getQty('oil') },
        ],
        missingCount: 0,
        instructions: [
          'Heat a wok or large pan on high heat with cooking oil.',
          'Add diced onions and veggies, stir-frying rapidly for 2-3 minutes to keep them crisp.',
          'Add cold or day-old cooked rice, breaking up any clumps with your spatula.',
          'Drizzle sauce and spices, tossing vigorously for 2 minutes on high heat.',
        ],
        tips: 'Using chilled leftover rice prevents the fried rice from getting soggy.',
      },
      {
        id: 'paneer_or_tofu_stir_fry',
        title: 'Savory Sautéed Paneer / Tofu & Capsicum',
        description: 'Tender cubes of paneer or firm tofu seared golden with bell peppers and warm house spices.',
        prepTimeMinutes: 8,
        cookTimeMinutes: 12,
        servings: roommates.length || 2,
        difficulty: 'Medium',
        dietaryTags: ['High-Protein', 'Vegetarian'],
        compatibleRoommates: [],
        ingredients: [
          { name: 'paneer or tofu', quantity: 200, unit: 'g', inPantry: has('paneer') || has('tofu'), pantryQuantity: getQty('paneer') + getQty('tofu') },
          { name: 'onions', quantity: 1, unit: 'medium', inPantry: has('onion'), pantryQuantity: getQty('onion') },
          { name: 'capsicum / bell pepper', quantity: 1, unit: 'item', inPantry: has('capsicum') || has('pepper') || has('tomato'), pantryQuantity: 1 },
          { name: 'spices (garam masala, coriander)', quantity: 1, unit: 'tsp', inPantry: has('spice') || has('masala'), pantryQuantity: 1 },
        ],
        missingCount: 0,
        instructions: [
          'Cut paneer or tofu into 1-inch cubes and lightly pan-fry in 1 tsp oil until golden.',
          'In the same pan, sauté sliced onions and peppers on high heat for 3 minutes.',
          'Add spice mix and salt, splash 2 tbsp water, and return the paneer/tofu to the pan.',
          'Coat well and serve hot with bread, roti, or salad.',
        ],
        tips: 'Soak paneer in warm water for 5 minutes before cooking for ultra-soft texture.',
      }
    ];

    // Compute missing counts and roommate compatibility
    const processedRecipes = templateRecipes.map(recipe => {
      recipe.missingCount = recipe.ingredients.filter(ing => !ing.inPantry).length;
      recipe.compatibleRoommates = roommates
        .filter(r => isRoommateSafe(recipe.dietaryTags, r))
        .map(r => r.displayName);
      return recipe;
    });

    // Sort by fewest missing ingredients
    processedRecipes.sort((a, b) => a.missingCount - b.missingCount);

    return {
      headline: `Tabby found ${processedRecipes.filter(r => r.missingCount === 0).length} instant pantry recipes and ${processedRecipes.length} curated meal ideas.`,
      recipes: processedRecipes,
    };
  }
}
