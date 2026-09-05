# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Roommates who coordinate groceries, meals, shared bills, and household preferences through one shared home.

## Product Purpose

Tabby turns natural conversation into household actions. A general chat understands intent, routes work to focused Grocery, Chef, or Billing agents, and maintains useful context so roommates do not have to repeatedly explain preferences and routines.

## Positioning

The conversation itself is the household operating surface: specialist agents act behind one voice, while TabbyBrain converts relevant personal statements into private preference memory and a deliberately limited household context that other roommates can query.

## Operating Context

Roommates use Tabby from a browser while shopping, planning meals, entering receipts, or checking what the household needs. Pantry, member, expense, and shareable context data update through SpacetimeDB. OpenAI-enhanced analysis is optional; core intent routing and memory extraction must remain functional without an API key.

## Capabilities and Constraints

- The main interface is a general-purpose chat, not a set of primary tabs.
- Grocery, Chef, and Billing are routed specialists surfaced only when relevant.
- TabbyBrain is hidden from the agent roster and continuously analyzes messages for durable household preferences.
- Raw personal conversations and private memory are not shared with roommates.
- Only concise, household-relevant context may enter the shared context stream.
- Existing pantry, expense, member, and chat reducers remain the shared backend contract.
- No fabricated roommate, pantry, expense, or preference data may appear.
- The interface must contain no emojis.

## Brand Commitments

The product name is Tabby. Its voice is calm, direct, useful, and domestic without being cute or gamified.

## Evidence on Hand

The repository contains working shopping, cooking, billing, OpenAI, household-profile, and SpacetimeDB services. There are no approved customer claims, testimonials, or photographic brand assets; future work must not invent them.

## Product Principles

1. Conversation should be faster than navigating.
2. Specialist intelligence should feel coordinated, not fragmented.
3. Personal context stays private until it is safe and useful to share.
4. Every assistant claim should be grounded in current household data.
5. Core household actions must work without an AI provider.

## Accessibility & Inclusion

The web interface must remain keyboard operable, responsive, readable at 200% zoom, and respectful of reduced-motion preferences.
