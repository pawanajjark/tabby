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

const SAFE_SHARED_CATEGORIES = new Set<MemoryCategory>(['diet', 'allergy', 'food_preference', 'routine']);
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

  static async analyze(message: string): Promise<BrainAnalysis> {
    const heuristicIntent = this.detectIntent(message);
    const heuristicFacts = this.extractFacts(message);
    let intent = heuristicIntent;
    let facts = heuristicFacts;

    if (AIProvider.hasApiKey()) {
      const result = await AIProvider.generateJson<{
        intent?: AgentIntent;
        facts?: Array<{
          category?: MemoryCategory;
          key?: string;
          value?: string;
          visibility?: 'private' | 'shared';
        }>;
      }>(
        `Analyze this household chat message for routing and durable preferences.\n\nMessage: ${message}`,
        `You are TabbyBrain, an accurate household intent and memory classifier.
Route to exactly ONE intent:
- "context": When the user is stating or updating a personal/household preference, diet, allergy, like/dislike (e.g. "I like chicken", "I prefer mutton biriyani", "except when...", "I am vegetarian").
- "chef": ONLY when the user explicitly asks for recipes, instructions on how to cook/make a dish, or meal suggestions (e.g. "How do I make biriyani?", "Give me a dinner recipe", "What can I cook?").
- "grocery": When discussing buying items, restocking, shopping lists, or pantry additions.
- "billing": When discussing receipts, expenses, paying bills, splitting costs.
- "general": General conversation or queries that don't match above.

Extract only facts explicitly stated by the speaker (likes, dislikes, exceptions, diets, allergies).
Shared facts are limited to diet, food allergy, food preference, and household cooking routine.
Return JSON with intent and facts.`
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
      .slice(0, 4)
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

  private static extractFacts(message: string): MemoryFact[] {
    const facts: MemoryFact[] = [];
    const sentences = message.split(/(?<=[.!?\n])\s+/).filter(s => s.trim().length > 0);
    const targetPhrases = sentences.length > 1 ? [message, ...sentences] : [message];

    for (const phrase of targetPhrases) {
      const diet = phrase.match(/\b(?:i am|i'm|im)\s+(vegetarian|vegan|eggetarian|jain|halal|gluten[- ]free|lactose[- ]intolerant)\b/i);
      if (diet) facts.push(makeFact('diet', 'diet', diet[1].replace(/-/g, ' ').toLowerCase(), 'shared'));

      const allergy = phrase.match(/\b(?:i am|i'm|im)?\s*allergic to\s+([^.!?]+)/i);
      if (allergy) facts.push(makeFact('allergy', 'allergy', `Allergic to ${normalized(allergy[1])}`, 'shared'));

      const avoid = phrase.match(/\b(?:i do not eat|i don't eat|i avoid|i cannot eat|i can't eat)\s+([^.!?]+)/i);
      if (avoid) facts.push(makeFact('food_preference', 'avoids', `Avoids ${normalized(avoid[1])}`, 'shared'));

      const like = phrase.match(/\b(?:i like|i love|my favorite (?:food|dish|meal) is)\s+([^.!?]+)/i);
      if (like) facts.push(makeFact('food_preference', 'likes', `Likes ${normalized(like[1])}`, 'shared'));

      const preference = phrase.match(/\b(?:i generally prefer|i prefer|except when it is in|except when|i dislike|i hate)\s+([^.!?]+)/i);
      if (preference) facts.push(makeFact('food_preference', 'preference', normalized(preference[0]), 'shared'));

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
