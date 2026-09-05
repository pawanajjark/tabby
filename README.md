# Tabby

Tabby is a shared, live memory for a flat. Roommates chat to record pantry purchases and bills; every connected browser immediately receives the same updated household state.

## How SpacetimeDB powers Tabby

SpacetimeDB is the only shared backend. Its public tables (`member`, `pantry_item`, `expense`, `expense_split`, and `chat_message`) are subscribed to by every browser. Reducers are transactional commands: a pantry update or an expense plus all of its splits either succeeds together or changes nothing.

The browser currently uses regex to recognize a few chat messages and calls the relevant reducer. This deliberately keeps the future AI-agent boundary simple: an LLM can later produce the same structured actions without changing the tables or business rules.

## Run Tabby

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Open the Vite address shown in the terminal. By default it connects to the cloud-hosted `tabby` database at Maincloud, so other people can share the same household state. Open it in multiple tabs to see realtime synchronization.

For local backend work instead, run `spacetime start`, use `spacetime dev tabby --server local --yes` to rebuild/publish/regenerate bindings, and set `VITE_SPACETIMEDB_URI=ws://localhost:3000` for the frontend.

## First regex commands

- `I bought 10 eggs`
- `Electricity bill ₹2400`

Before recording expenses, each roommate needs a display name. The initial UI will add this next; the current backend reducer is already available as `setDisplayName`.
