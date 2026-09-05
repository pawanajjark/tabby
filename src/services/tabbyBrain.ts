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
  ['chef', /\b(cook|cooking|recipe|meal|dinner|lunch|breakfast|hungry|dish|chef|pizza)\b|\b(?:how (?:do|can) i|can you|help me|make me|what can i)\s+(?:make|prepare)\b/i],
  ['grocery', /\b(bought|buy|pantry|grocery|groceries|restock|stock|shopping|ran out|need more)\b/i],
  ['context', /\b(remember|preference|preferences|allerg|diet|who likes|who eats|what does|what do we know|household context)\b/i],
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
        `You are TabbyBrain, a hidden household intent and memory classifier.
Route to exactly one intent: grocery, chef, billing, context, or general.
Extract only facts explicitly stated by the speaker. Never infer sensitive traits.
Shared facts are limited to diet, food allergy, food preference, and household cooking routine information that helps roommates coordinate groceries, meals, or bills.
Everything else must be private. Return an empty facts array when nothing durable was stated.
Return JSON with intent and facts. Each fact has category, key, value, and visibility.`
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
    const diet = message.match(/\b(?:i am|i'm|im)\s+(vegetarian|vegan|eggetarian|jain|halal|gluten[- ]free|lactose[- ]intolerant)\b/i);
    if (diet) facts.push(makeFact('diet', 'diet', diet[1].replace(/-/g, ' ').toLowerCase(), 'shared'));

    const allergy = message.match(/\b(?:i am|i'm|im)?\s*allergic to\s+([^.!?]+)/i);
    if (allergy) facts.push(makeFact('allergy', 'allergy', `Allergic to ${normalized(allergy[1])}`, 'shared'));

    const avoid = message.match(/\b(?:i do not eat|i don't eat|i avoid|i cannot eat|i can't eat)\s+([^.!?]+)/i);
    if (avoid) facts.push(makeFact('food_preference', 'avoids', `Avoids ${normalized(avoid[1])}`, 'shared'));

    const like = message.match(/\b(?:i like|i love|i prefer|my favorite (?:food|dish|meal) is)\s+([^.!?]+)/i);
    if (like) facts.push(makeFact('food_preference', 'likes', `Likes ${normalized(like[1])}`, 'shared'));

    const routine = message.match(/\b(?:i usually|i normally|every (?:morning|evening|week|weekend) i)\s+([^.!?]+)/i);
    if (routine) facts.push(makeFact('routine', 'routine', normalized(routine[0]), 'shared'));

    return this.mergeFacts([], facts);
  }

  private static mergeFacts(existing: MemoryFact[], incoming: MemoryFact[]) {
    const facts = new Map(existing.map(fact => [fact.id, fact]));
    incoming.forEach(fact => facts.set(fact.id, fact));
    return [...facts.values()];
  }
}
