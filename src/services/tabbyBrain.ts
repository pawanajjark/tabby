import { AIProvider } from './aiProvider';

export type AgentIntent = 'grocery' | 'chef' | 'billing' | 'context' | 'general';
export type MemoryCategory = 'diet' | 'allergy' | 'food_preference' | 'routine' | 'household_note';

export interface MemoryFact {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  visibility: 'private' | 'shared';
  learnedAt: string;
}

export interface SharedContextRecord extends MemoryFact {
  subjectIdentity: string;
  subjectName: string;
}

export interface BrainAnalysis {
  intent: AgentIntent;
  confidence: number;
  privateFacts: MemoryFact[];
  shareableFacts: MemoryFact[];
}

const INTENT_RULES: Array<[AgentIntent, RegExp]> = [
  ['billing', /\b(bill|expense|receipt|split|paid|owe|owed|cost|total|reimburse)\b|(?:₹|rs\.?|inr|\$)\s*[\d,]+|(?:^|\n).+[-:]\s*\d+(?:\.\d{1,2})?\s*$/im],
  ['context', /\b(i like|i love|i prefer|i hate|i don't like|i dislike|i avoid|i eat|i don't eat|except when|allergic|allergy|vegetarian|vegan|eggetarian|halal|jain|diet|preference|preferences|who likes|who eats|what do we know|remember)\b/i],
  ['chef', /\b(recipe|recipes|how (?:to|do i|can i) (?:cook|make|bake|prepare)|what can (?:i|we) (?:cook|make)|what should (?:i|we) (?:cook|make)|suggest (?:a |some )?(?:recipe|meal|dinner|lunch)|let's cook|cook (?:something|dinner|lunch|breakfast))\b/i],
  ['grocery', /\b(bought|buy|pantry|grocery|groceries|restock|stock|shopping|ran out|need more)\b/i],
];

const SAFE_SHARED_CATEGORIES = new Set<MemoryCategory>(['diet', 'allergy', 'food_preference', 'routine', 'household_note']);
const STORAGE_PREFIX = 'tabby_brain_private_v1';

function normalized(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function factId(category: MemoryCategory, key: string, value: string) {
  const source = `${category}:${key}:${value}`.toLowerCase();
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `memory_${(hash >>> 0).toString(36)}`;
}

function makeFact(category: MemoryCategory, key: string, value: string, visibility: 'private' | 'shared'): MemoryFact {
  const cleanKey = normalized(key).toLowerCase();
  const cleanValue = normalized(value);
  return {
    id: factId(category, cleanKey, cleanValue),
    category,
    key: cleanKey,
    value: cleanValue,
    visibility,
    learnedAt: new Date().toISOString(),
  };
}

export class TabbyBrain {
  static createSharedFact(category: MemoryCategory, key: string, value: string): MemoryFact {
    return makeFact(category, key, value, 'shared');
  }

  static detectIntent(message: string): AgentIntent {
    return INTENT_RULES.find(([, pattern]) => pattern.test(message))?.[0] ?? 'general';
  }

  static async analyze(
    message: string,
    recentHistory: Array<{ role: string; text?: string }> = [],
    existingContext: SharedContextRecord[] = []
  ): Promise<BrainAnalysis> {
    const heuristicIntent = this.detectIntent(message);
    const heuristicFacts = this.extractFacts(message, recentHistory, existingContext);
    let intent = heuristicIntent;
    let facts = heuristicFacts;

    if (AIProvider.hasApiKey()) {
      const historySummary = recentHistory
        .slice(-8)
        .map(msg => `${msg.role}: ${msg.text || ''}`)
        .filter(t => t.trim().length > 0)
        .join('\n');

      const contextSummary = existingContext
        .slice(0, 15)
        .map(c => `${c.subjectName}: [${c.category}] ${c.value}`)
        .join('; ');

      const result = await AIProvider.generateJson<{
        intent?: AgentIntent;
        facts?: Array<{
          category?: MemoryCategory;
          key?: string;
          value?: string;
          visibility?: 'private' | 'shared';
        }>;
      }>(
        `Recent Conversation History:\n${historySummary || 'None'}\n\nExisting Shared Household Memories:\n${contextSummary || 'None'}\n\nNew Message to Analyze:\n${message}`,
        `You are TabbyBrain, an expert household intent classifier and high-recall insight extractor.

Intent Routing Rules:
- "context": When the user states, updates, refines, queries, or clarifies personal/household preferences, food likes/dislikes, dietary rules, habits, allergies, or exceptions.
- "chef": ONLY when the user explicitly requests a recipe, asks how to cook/make a dish, or asks for meal suggestions right now (e.g. "How do I make biriyani?", "Give me a dinner recipe", "What can I cook?").
- "grocery": When discussing buying items, restocking, shopping lists, or pantry additions.
- "billing": When discussing receipts, expenses, paying bills, splitting costs.
- "general": General conversation or queries that don't match above.

MAXIMAL INSIGHT EXTRACTION RULES:
Extract every explicit, implicit, contextual, conditional, and exception preference:
1. Coreference & Context Resolution:
   - If the user says "Except when it is in Biriyani", resolve "it" using previous messages or context (e.g. if the user liked "Chicken", "it" refers to chicken).
   - Extract the full contextual dislike/exception explicitly: "Dislikes chicken biriyani / does not like chicken in biriyani".
2. Multi-Insight Extraction:
   - For a message like "Except when it is in Biriyani. I generally prefer mutton biriyani":
     * Extract fact 1: category "food_preference", key "dislikes", value "Dislikes chicken in biriyani / chicken biriyani", visibility "shared"
     * Extract fact 2: category "food_preference", key "preference", value "Prefers mutton biriyani", visibility "shared"
3. Extract all explicit likes, dislikes, avoids, favorites, dietary tags, allergies, and cooking routines.
4. Allowed categories: "diet", "allergy", "food_preference", "routine", "household_note".
5. Set visibility to "shared" for all food preferences, exceptions, allergies, diets, and routines.

Return valid JSON with "intent" and "facts".`
      );

      if (result?.intent && ['grocery', 'chef', 'billing', 'context', 'general'].includes(result.intent)) {
        intent = result.intent;
      }

      const aiFacts = (result?.facts ?? [])
        .filter(fact => fact.category && fact.key && fact.value)
        .map(fact => {
          const category = fact.category as MemoryCategory;
          const visibility = fact.visibility === 'shared' && SAFE_SHARED_CATEGORIES.has(category) ? 'shared' : 'private';
          return makeFact(category, fact.key!, fact.value!, visibility);
        });

      if (aiFacts.length > 0) facts = this.mergeFacts(heuristicFacts, aiFacts);
    }

    // Strict Guard: Chef intent should ONLY trigger on explicit recipe or cooking requests
    const isExplicitCookingRequest = /\b(?:recipe|recipes|how (?:to|do i|can i) (?:cook|make|bake|prepare)|what can (?:i|we) (?:cook|make)|what should (?:i|we) (?:cook|make)|suggest (?:a |some )?(?:recipe|meal|dinner|lunch)|let's cook|cook (?:something|dinner|lunch|breakfast)|prepare (?:a |some )?(?:meal|dinner|lunch|breakfast))\b/i.test(message);

    if (facts.length > 0 || !isExplicitCookingRequest) {
      if (intent === 'chef' && !isExplicitCookingRequest) {
        intent = facts.length > 0 ? 'context' : 'general';
      } else if (facts.length > 0 && intent !== 'grocery' && intent !== 'billing' && !isExplicitCookingRequest) {
        intent = 'context';
      }
    }

    return {
      intent,
      confidence: intent === heuristicIntent ? 0.92 : 0.78,
      privateFacts: facts,
      shareableFacts: facts.filter(fact => fact.visibility === 'shared'),
    };
  }

  static savePrivateFacts(identity: string, facts: MemoryFact[]) {
    if (!identity || facts.length === 0) return;
    const existing = this.getPrivateFacts(identity);
    const merged = this.mergeFacts(existing, facts);
    localStorage.setItem(`${STORAGE_PREFIX}:${identity}`, JSON.stringify(merged));
  }

  static getPrivateFacts(identity: string): MemoryFact[] {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}:${identity}`);
      return stored ? JSON.parse(stored) as MemoryFact[] : [];
    } catch {
      return [];
    }
  }

  static toSharedRecord(fact: MemoryFact, subjectIdentity: string, subjectName: string): SharedContextRecord {
    return { ...fact, visibility: 'shared', subjectIdentity, subjectName };
  }

  static parseSharedRecord(value: string): SharedContextRecord | null {
    try {
      const record = JSON.parse(value) as SharedContextRecord;
      if (!record.id || !record.subjectIdentity || !record.subjectName || !record.key || !record.value) return null;
      if (!SAFE_SHARED_CATEGORIES.has(record.category)) return null;
      return record;
    } catch {
      return null;
    }
  }

  static answerContextQuestion(question: string, records: SharedContextRecord[]): string | null {
    if (records.length === 0) return null;
    const query = question.toLowerCase();
    const terms = query.split(/[^a-z0-9]+/).filter(term => term.length > 2);
    const ranked = records
      .map(record => {
        const haystack = `${record.subjectName} ${record.category} ${record.key} ${record.value}`.toLowerCase();
        const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
        return { record, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const relevant = (ranked.length > 0 ? ranked : records.map(record => ({ record, score: 0 })))
      .slice(0, 6)
      .map(item => item.record);

    const byPerson = new Map<string, string[]>();
    relevant.forEach(record => {
      const facts = byPerson.get(record.subjectName) ?? [];
      if (!facts.includes(record.value)) facts.push(record.value);
      byPerson.set(record.subjectName, facts);
    });

    return [...byPerson.entries()]
      .map(([name, facts]) => `${name}: ${facts.join('; ')}`)
      .join(' ');
  }

  private static extractFacts(
    message: string,
    recentHistory: Array<{ role: string; text?: string }> = [],
    existingContext: SharedContextRecord[] = []
  ): MemoryFact[] {
    const facts: MemoryFact[] = [];
    const sentences = message.split(/(?<=[.!?\n])\s+/).filter(s => s.trim().length > 0);
    const targetPhrases = sentences.length > 1 ? [message, ...sentences] : [message];

    // Find previous food subject if available (e.g., "chicken" from "I like chicken")
    let previousFoodSubject = '';
    for (let i = recentHistory.length - 1; i >= 0; i--) {
      const text = recentHistory[i].text || '';
      const m = text.match(/\b(?:i like|i love|prefer|eat)\s+([a-zA-Z\s]+)/i);
      if (m) {
        previousFoodSubject = normalized(m[1]).split(/\s+(?:and|or|but|except)\s+/i)[0].trim();
        break;
      }
    }
    if (!previousFoodSubject && existingContext.length > 0) {
      const foodFact = existingContext.find(c => c.category === 'food_preference' && c.key === 'likes');
      if (foodFact) {
        const m = foodFact.value.match(/Likes\s+([a-zA-Z\s]+)/i);
        if (m) previousFoodSubject = normalized(m[1]);
      }
    }

    for (const phrase of targetPhrases) {
      const diet = phrase.match(/\b(?:i am|i'm|im)\s+(vegetarian|vegan|eggetarian|jain|halal|gluten[- ]free|lactose[- ]intolerant)\b/i);
      if (diet) facts.push(makeFact('diet', 'diet', diet[1].replace(/-/g, ' ').toLowerCase(), 'shared'));

      const allergy = phrase.match(/\b(?:i am|i'm|im)?\s*allergic to\s+([^.!?]+)/i);
      if (allergy) facts.push(makeFact('allergy', 'allergy', `Allergic to ${normalized(allergy[1])}`, 'shared'));

      const avoid = phrase.match(/\b(?:i do not eat|i don't eat|i avoid|i cannot eat|i can't eat)\s+([^.!?]+)/i);
      if (avoid) facts.push(makeFact('food_preference', 'avoids', `Avoids ${normalized(avoid[1])}`, 'shared'));

      const dislike = phrase.match(/\b(?:i do not like|i don't like|i dislike|i hate)\s+([^.!?]+)/i);
      if (dislike) facts.push(makeFact('food_preference', 'dislikes', `Dislikes ${normalized(dislike[1])}`, 'shared'));

      const like = phrase.match(/\b(?:i like|i love|my favorite (?:food|dish|meal) is)\s+([^.!?]+)/i);
      if (like) facts.push(makeFact('food_preference', 'likes', `Likes ${normalized(like[1])}`, 'shared'));

      const exception = phrase.match(/\b(?:except when it is in|except in|except when in|except for|not when in|not in)\s+([^.!?]+)/i);
      if (exception) {
        const targetDish = normalized(exception[1]);
        if (previousFoodSubject) {
          facts.push(makeFact('food_preference', 'dislikes', `Dislikes ${previousFoodSubject} in ${targetDish}`, 'shared'));
          facts.push(makeFact('food_preference', 'avoids', `Avoids ${previousFoodSubject} in ${targetDish}`, 'shared'));
        } else {
          facts.push(makeFact('food_preference', 'exception', `Except in ${targetDish}`, 'shared'));
        }
      }

      const preference = phrase.match(/\b(?:i generally prefer|i prefer)\s+([^.!?]+)/i);
      if (preference) facts.push(makeFact('food_preference', 'preference', `Prefers ${normalized(preference[1])}`, 'shared'));

      const routine = phrase.match(/\b(?:i usually|i normally|every (?:morning|evening|week|weekend) i)\s+([^.!?]+)/i);
      if (routine) facts.push(makeFact('routine', 'routine', normalized(routine[0]), 'shared'));
    }

    return this.mergeFacts([], facts);
  }

  private static mergeFacts(existing: MemoryFact[], incoming: MemoryFact[]) {
    const facts = new Map(existing.map(fact => [fact.id, fact]));
    incoming.forEach(fact => facts.set(fact.id, fact));
    return [...facts.values()];
  }
}
