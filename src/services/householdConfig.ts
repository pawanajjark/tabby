export type DietaryTag = 'vegetarian' | 'vegan' | 'eggetarian' | 'non_veg' | 'jain' | 'halal' | 'lactose_intolerant' | 'gluten_free' | 'no_alcohol';

export interface RoommateProfile {
  identityHex: string;
  displayName: string;
  dietaryTags: DietaryTag[];
  cookingHabits: string[];
  customSplitExclusions: string[];
  foodPreferences?: string[];
  allergies?: string[];
  notes?: string[];
}

export interface SplitRule {
  id: string;
  name: string;
  description: string;
  category: string;
  exemptTags: DietaryTag[];
  enabled: boolean;
}

export interface HouseholdScope {
  identity: string;
  homeId: string;
}

export interface HouseholdConfigStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DEFAULT_SPLIT_RULES: SplitRule[] = [
  { id: 'veg_no_meat', name: 'Vegetarian Exemption', description: 'Vegetarian and Vegan roommates do not pay for non-veg / meat / seafood items.', category: 'non_veg', exemptTags: ['vegetarian', 'vegan', 'jain'], enabled: true },
  { id: 'vegan_no_dairy', name: 'Vegan & Lactose-Free Exemption', description: 'Vegan and Lactose-intolerant roommates do not pay for dedicated milk/cheese items.', category: 'dairy', exemptTags: ['vegan', 'lactose_intolerant'], enabled: true },
  { id: 'no_alcohol', name: 'Teetotaler Exemption', description: 'Roommates who do not drink alcohol do not pay for alcoholic beverages.', category: 'alcohol', exemptTags: ['no_alcohol'], enabled: true },
];

function storageKey(scope: HouseholdScope, kind: 'profiles' | 'rules'): string {
  const identity = encodeURIComponent(scope.identity.trim().toLowerCase());
  const homeId = encodeURIComponent(scope.homeId.trim());
  if (!identity || !homeId) throw new Error('Identity and home are required to scope household data.');
  return `tabby_household_v2:${identity}:${homeId}:${kind}`;
}

export class ScopedHouseholdConfigRepository {
  private readonly scope: HouseholdScope;
  private readonly storage: HouseholdConfigStorage;

  constructor(
    scope: HouseholdScope,
    storage: HouseholdConfigStorage = globalThis.localStorage,
  ) {
    this.scope = scope;
    this.storage = storage;
  }

  getProfiles(): Record<string, RoommateProfile> {
    try {
      const parsed = JSON.parse(this.storage.getItem(storageKey(this.scope, 'profiles')) ?? '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  getProfile(identityHex: string, fallbackName = 'Roommate'): RoommateProfile {
    const profiles = this.getProfiles();
    return profiles[identityHex] ?? {
      identityHex,
      displayName: fallbackName,
      dietaryTags: [],
      cookingHabits: [],
      customSplitExclusions: [],
    };
  }

  saveProfile(profile: RoommateProfile): void {
    const profiles = this.getProfiles();
    profiles[profile.identityHex] = profile;
    this.storage.setItem(storageKey(this.scope, 'profiles'), JSON.stringify(profiles));
  }

  getRules(): SplitRule[] {
    try {
      const stored = this.storage.getItem(storageKey(this.scope, 'rules'));
      if (!stored) return DEFAULT_SPLIT_RULES.map(rule => ({ ...rule, exemptTags: [...rule.exemptTags] }));
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  saveRules(rules: SplitRule[]): void {
    this.storage.setItem(storageKey(this.scope, 'rules'), JSON.stringify(rules));
  }

  toggleRule(ruleId: string): void {
    this.saveRules(this.getRules().map(rule => rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule));
  }

  clearScope(): void {
    this.storage.removeItem(storageKey(this.scope, 'profiles'));
    this.storage.removeItem(storageKey(this.scope, 'rules'));
  }
}

export class HouseholdConfigManager {
  static forScope(scope: HouseholdScope, storage?: HouseholdConfigStorage): ScopedHouseholdConfigRepository {
    return new ScopedHouseholdConfigRepository(scope, storage);
  }
}
