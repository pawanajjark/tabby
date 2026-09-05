// src/services/householdConfig.ts

export type DietaryTag = 'vegetarian' | 'vegan' | 'eggetarian' | 'non_veg' | 'jain' | 'halal' | 'lactose_intolerant' | 'gluten_free' | 'no_alcohol';

export interface RoommateProfile {
  identityHex: string;
  displayName: string;
  dietaryTags: DietaryTag[];
  cookingHabits: string[];
  customSplitExclusions: string[];
}

export interface SplitRule {
  id: string;
  name: string;
  description: string;
  category: string;
  exemptTags: DietaryTag[];
  enabled: boolean;
}

export const DEFAULT_SPLIT_RULES: SplitRule[] = [
  {
    id: 'veg_no_meat',
    name: 'Vegetarian Exemption',
    description: 'Vegetarian and Vegan roommates do not pay for non-veg / meat / seafood items.',
    category: 'non_veg',
    exemptTags: ['vegetarian', 'vegan', 'jain'],
    enabled: true,
  },
  {
    id: 'vegan_no_dairy',
    name: 'Vegan & Lactose-Free Exemption',
    description: 'Vegan and Lactose-intolerant roommates do not pay for dedicated milk/cheese items.',
    category: 'dairy',
    exemptTags: ['vegan', 'lactose_intolerant'],
    enabled: true,
  },
  {
    id: 'no_alcohol',
    name: 'Teetotaler Exemption',
    description: 'Roommates who do not drink alcohol do not pay for alcoholic beverages.',
    category: 'alcohol',
    exemptTags: ['no_alcohol'],
    enabled: true,
  },
];

const STORAGE_KEY = 'tabby_household_profiles';
const RULES_KEY = 'tabby_household_rules';

export class HouseholdConfigManager {
  static getProfiles(): Record<string, RoommateProfile> {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  static getProfile(identityHex: string, fallbackName = 'Roommate'): RoommateProfile {
    const profiles = this.getProfiles();
    if (profiles[identityHex]) {
      return profiles[identityHex];
    }
    return {
      identityHex,
      displayName: fallbackName,
      dietaryTags: [],
      cookingHabits: [],
      customSplitExclusions: [],
    };
  }

  static saveProfile(profile: RoommateProfile) {
    const profiles = this.getProfiles();
    profiles[profile.identityHex] = profile;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  }

  static getRules(): SplitRule[] {
    try {
      const data = localStorage.getItem(RULES_KEY);
      return data ? JSON.parse(data) : DEFAULT_SPLIT_RULES;
    } catch {
      return DEFAULT_SPLIT_RULES;
    }
  }

  static saveRules(rules: SplitRule[]) {
    localStorage.setItem(RULES_KEY, JSON.stringify(rules));
  }

  static toggleRule(ruleId: string) {
    const rules = this.getRules();
    const updated = rules.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r);
    this.saveRules(updated);
  }
}
