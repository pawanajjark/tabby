import test from 'node:test';
import assert from 'node:assert/strict';
import { TabbyBrain } from '../src/services/tabbyBrain.ts';
import { AgentCooking } from '../src/services/agentCooking.ts';
import type { RoommateProfile } from '../src/services/householdConfig.ts';

test('making a dish or cooking requests referring to home notes route to chef agent', async () => {
  const dishPrompts = [
    'Make a dish referring to our home notes',
    'Make a dish considering everyone\'s preferences',
    'Cook dinner based on our home notes',
    'I want to make chicken biryani taking everyone\'s preferences into account',
    'Suggest a recipe considering our dietary preferences in home notes',
    'What can we cook tonight based on home notes?',
  ];

  for (const prompt of dishPrompts) {
    assert.equal(TabbyBrain.detectIntent(prompt), 'chef', `detectIntent failed for: ${prompt}`);
    const analysis = await TabbyBrain.analyze(prompt);
    assert.equal(analysis.intent, 'chef', `analyze failed for: ${prompt}`);
  }
});

test('assigning a task or chores referring to home notes route to general household coordination', async () => {
  const taskPrompts = [
    'Assign a task based on home notes',
    'Assign chores according to our preferences in home notes',
    'Who should clean the kitchen based on our routines?',
    'Assign task for dishwashing considering home notes',
    'Distribute household chores based on preferences',
  ];

  for (const prompt of taskPrompts) {
    assert.equal(TabbyBrain.detectIntent(prompt), 'general', `detectIntent failed for: ${prompt}`);
    const analysis = await TabbyBrain.analyze(prompt);
    assert.equal(analysis.intent, 'general', `analyze failed for: ${prompt}`);
  }
});

test('AgentCooking accepts home notes and serves requested dish while considering preferences', async () => {
  const pantry = [
    { name: 'rice', quantity: 1, unit: 'kg' },
    { name: 'chicken', quantity: 500, unit: 'g' },
    { name: 'onion', quantity: 3, unit: 'items' },
    { name: 'tomato', quantity: 2, unit: 'items' },
    { name: 'oil', quantity: 1, unit: 'bottle' },
  ];

  const roommates: RoommateProfile[] = [
    {
      identityHex: 'user1',
      displayName: 'Alex',
      dietaryTags: ['non_veg'],
      cookingHabits: ['cooks dinner'],
      customSplitExclusions: [],
      foodPreferences: ['Prefers chicken biryani'],
      allergies: ['peanuts'],
    },
    {
      identityHex: 'user2',
      displayName: 'Sam',
      dietaryTags: ['vegetarian'],
      cookingHabits: ['quick meals'],
      customSplitExclusions: [],
      foodPreferences: ['Likes pasta'],
    },
  ];

  const homeNotes = [
    { subjectName: 'Alex', category: 'allergy', value: 'Allergic to peanuts' },
    { subjectName: 'Alex', category: 'food_preference', value: 'Prefers spicy biryani' },
    { subjectName: 'Sam', category: 'diet', value: 'vegetarian' },
  ];

  const plan = await AgentCooking.generateRecipes(pantry, roommates, 'Make chicken biryani based on home notes', homeNotes);
  assert.ok(plan.recipes.length > 0);
  assert.equal(plan.recipes[0].id, 'requested_biryani');
  assert.ok(plan.recipes[0].title.toLowerCase().includes('biryani'));
});
