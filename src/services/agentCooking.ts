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
  substitution?: string;
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
   * roommate dietary rules, frequent cooking habits, and shared Home notes.
   */
  static async generateRecipes(
    pantryItems: PantryItemData[],
    roommates: RoommateProfile[],
    request = '',
    homeNotes: Array<{ subjectName?: string; category?: string; value?: string }> = [],
  ): Promise<CookingPlan> {
    const pantrySummary = pantryItems.map(i => `${i.name} (${i.quantity} ${i.unit})`).join(', ') || 'Empty pantry';
    const roommateProfilesText = roommates.map(r => {
      const parts = [`${r.displayName}:`];
      if (r.dietaryTags.length) parts.push(`Diets=[${r.dietaryTags.join(', ')}]`);
      if (r.cookingHabits.length) parts.push(`Habits=[${r.cookingHabits.join(', ')}]`);
      if (r.allergies?.length) parts.push(`Allergies=[${r.allergies.join(', ')}]`);
      if (r.foodPreferences?.length) parts.push(`Preferences=[${r.foodPreferences.join(', ')}]`);
      if (r.notes?.length) parts.push(`Notes=[${r.notes.join(', ')}]`);
      return parts.join(' ');
    }).join('\n') || 'No roommates registered';

    const homeNotesSummary = homeNotes.length > 0
      ? homeNotes.map(n => `- ${n.subjectName || 'Household'}: [${n.category || 'note'}] ${n.value}`).join('\n')
      : 'No additional home notes recorded.';

    if (AIProvider.hasApiKey()) {
      const prompt = `You are Tabby's Chef agent.
The user wants to make a dish or meal with request: "${request || 'Suggest something good to cook from the pantry.'}".

CRITICAL INSTRUCTIONS:
1. SERVE THE USER'S REQUEST: If the user specifically asked for a particular dish, meal, cuisine, or style (e.g. biryani, pasta, soup, curry), you MUST make and provide recipes for that requested dish.
2. REFER TO AND HONOR ALL HOME NOTES & PREFERENCES: Thoroughly consult all Home Notes, roommate dietary rules, allergies, food likes/dislikes, habits, and exceptions listed below.
3. ADAPT TO CONSTRAINTS: Tailor the requested dish (using ingredient choices, safe substitutions, or variations) so it respects all roommates' dietary restrictions and preferences from the Home Notes while strictly fulfilling what the user asked to make.
4. If no specific dish is named, suggest 3 practical recipes that satisfy everyone's preferences from the Home Notes and pantry.
5. INGREDIENTS & PANTRY: Prefer available pantry ingredients and make safe, realistic substitutions when they help. Creative household jugaad is welcome, but never suggest an unsafe or implausible swap. If the requested dish still needs ingredients, keep the requested dish and clearly identify what must be bought in the ingredients list (with inPantry=false). Never claim an ingredient is in the pantry unless it appears in the stock list below.

User request:
${request || 'Suggest something good to cook from the pantry.'}

Home notes & household preferences:
${homeNotesSummary}

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
          "inPantry": true,
          "substitution": "Optional: explain which conventional ingredient this pantry item replaces"
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
        'You are an inventive, practical household chef. Return JSON only. Always serve the user\'s requested dish while rigorously respecting all Home Notes, allergies, dietary constraints, and roommate preferences.'
      );

      if (aiResult && Array.isArray(aiResult.recipes) && aiResult.recipes.length > 0) {
        const pantryNames = pantryItems.map(item => item.name.toLowerCase().trim());
        const recipes = aiResult.recipes
          .filter(recipe => recipe && typeof recipe.title === 'string' && Array.isArray(recipe.ingredients))
          .map((recipe, index) => {
            const ingredients = recipe.ingredients
              .filter(ingredient => ingredient && typeof ingredient.name === 'string')
              .map(ingredient => {
                const name = ingredient.name.toLowerCase().trim();
                const inPantry = pantryNames.some(pantryName =>
                  pantryName.includes(name) || name.includes(pantryName)
                );
                return { ...ingredient, inPantry };
              });

            const instructions = Array.isArray(recipe.instructions)
              ? recipe.instructions.filter(step => typeof step === 'string' && step.trim())
              : [];
            return {
              ...recipe,
              id: recipe.id || `recipe_${index + 1}`,
              ingredients,
              missingCount: ingredients.filter(ingredient => !ingredient.inPantry).length,
              prepTimeMinutes: Number.isFinite(recipe.prepTimeMinutes) ? Math.max(0, recipe.prepTimeMinutes) : 10,
              cookTimeMinutes: Number.isFinite(recipe.cookTimeMinutes) ? Math.max(1, recipe.cookTimeMinutes) : 20,
              servings: Number.isFinite(recipe.servings) ? Math.max(1, recipe.servings) : Math.max(1, roommates.length),
              instructions,
              tips: typeof recipe.tips === 'string' ? recipe.tips : '',
              compatibleRoommates: Array.isArray(recipe.compatibleRoommates)
                ? recipe.compatibleRoommates
                : roommates.map(roommate => roommate.displayName),
            };
          });

        if (recipes.length > 0) {
          recipes.sort((a, b) => a.missingCount - b.missingCount);
          return { headline: aiResult.headline || 'Meals matched to your current pantry.', recipes };
        }
      }
    }

    return this.generateHeuristicRecipes(pantryItems, roommates, request, homeNotes);
  }

  private static generateHeuristicRecipes(
    pantryItems: PantryItemData[],
    roommates: RoommateProfile[],
    request = '',
    _homeNotes: Array<{ subjectName?: string; category?: string; value?: string }> = [],
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
      if (roommate.allergies?.some(a => tags.some(t => t.toLowerCase().includes(a.toLowerCase())))) return false;
      return true;
    };

    const requestedBiryani = /\bbir(?:yani|iyani)\b/i.test(request);
    const requestedProtein = /\bmutton\b/i.test(request) ? 'mutton' : /\bchicken\b/i.test(request) ? 'chicken' : 'mixed vegetables';
    const biryaniTags = requestedProtein === 'mixed vegetables' ? ['Vegetarian', 'Gluten-Free'] : ['Non-Veg', 'Gluten-Free'];
    const biryaniRecipe: Recipe = {
      id: 'requested_biryani',
      title: requestedProtein === 'mixed vegetables' ? 'Fragrant Vegetable Biryani' : `Fragrant ${requestedProtein[0].toUpperCase()}${requestedProtein.slice(1)} Biryani`,
      description: 'Layered basmati rice, aromatics, warming spices, and a practical dum-style finish.',
      prepTimeMinutes: 20,
      cookTimeMinutes: 35,
      servings: roommates.length || 2,
      difficulty: 'Medium',
      dietaryTags: biryaniTags,
      compatibleRoommates: [],
      ingredients: [
        { name: 'basmati rice', quantity: 500, unit: 'g', inPantry: has('basmati') || has('rice'), pantryQuantity: getQty('rice') },
        { name: requestedProtein, quantity: requestedProtein === 'mixed vegetables' ? 500 : 750, unit: 'g', inPantry: has(requestedProtein), pantryQuantity: getQty(requestedProtein) },
        { name: 'onions', quantity: 3, unit: 'items', inPantry: has('onion'), pantryQuantity: getQty('onion') },
        { name: 'tomatoes', quantity: 2, unit: 'items', inPantry: has('tomato'), pantryQuantity: getQty('tomato') },
        { name: 'yogurt', quantity: 200, unit: 'g', inPantry: has('yogurt') || has('curd'), pantryQuantity: getQty('yogurt') },
        { name: 'biryani masala', quantity: 1, unit: 'pack', inPantry: has('biryani masala') || has('garam masala'), pantryQuantity: 1 },
        { name: 'cooking oil', quantity: 3, unit: 'tbsp', inPantry: has('oil'), pantryQuantity: getQty('oil') },
      ],
      missingCount: 0,
      instructions: [
        'Rinse and soak the basmati rice for 20 minutes, then parboil it with salt until about three-quarters cooked.',
        'Brown sliced onions in oil. Add tomatoes, biryani masala, yogurt, and the vegetables or meat; cook until the filling is nearly done.',
        'Layer the rice over the filling, cover tightly, and cook on low heat for 15 minutes.',
        'Rest for 5 minutes, fluff gently, and serve hot.',
      ],
      tips: 'Keep the rice slightly firm before layering so the grains remain separate during dum cooking.',
    };

    const templateRecipes: Recipe[] = [
      ...(requestedBiryani ? [biryaniRecipe] : []),
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
          { name: 'salt', quantity: 1, unit: 'pinch', inPantry: has('salt'), pantryQuantity: getQty('salt') },
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

    // Keep the dish the user explicitly requested first, then rank the remaining
    // suggestions by how much of each recipe is already in the pantry.
    processedRecipes.sort((a, b) => {
      if (a.id === 'requested_biryani') return -1;
      if (b.id === 'requested_biryani') return 1;
      return a.missingCount - b.missingCount;
    });

    return {
      headline: `Tabby found ${processedRecipes.filter(r => r.missingCount === 0).length} instant pantry recipes and ${processedRecipes.length} curated meal ideas.`,
      recipes: processedRecipes,
    };
  }
}
