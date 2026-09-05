# Tabby

Tabby is a shared household workspace. Three focused agents turn live pantry data and roommate preferences into restock plans, meal suggestions, and fair itemized expense splits.

## How SpacetimeDB powers Tabby

SpacetimeDB is the only shared backend. Its public tables (`member`, `pantry_item`, `shopping_item`, `expense`, `expense_split`, and `chat_message`) are subscribed to by every browser. Reducers are transactional commands: a pantry update, grocery-plan replacement, or expense plus all of its splits either succeeds together or changes nothing.

The shopping and cooking agents work with a deterministic local planning engine and can use OpenAI for generated recommendations when configured. The billing agent parses itemized text without an API key and uses OpenAI vision for receipt images. Chat routes supported household requests to the same underlying actions.

## Run Tabby

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Open the Vite address shown in the terminal. By default it connects to the cloud-hosted `tabby` database at Maincloud, so other people can share the same household state. Open it in multiple tabs to see realtime synchronization.

For local backend work instead, run `spacetime start`, use `spacetime dev tabby --server local --yes` to rebuild/publish/regenerate bindings, and set `VITE_SPACETIMEDB_URI=ws://localhost:3000` for the frontend.

## Chat commands

- `I bought 10 eggs`
- `I bought 2 kg rice`
- `Electricity bill INR 2400`
- `What can we cook?`
- `Refresh the shopping plan`

Open **My profile** to add dietary preferences and cooking habits. Receipt text should contain one priced item per line, for example `Rice - 450`.

## Installable app and Android grocery widget

Tabby ships as an installable PWA and as a Capacitor Android project. The read-only home-screen widget displays the first three items in the latest shared grocery plan, the remaining count, and the last update time. Tapping it opens Tabby.

Generate and copy the latest web build into the Android project:

```bash
npm run android:sync
```

Open the native project in Android Studio:

```bash
npm run android:open
```

Run the app on an emulator or device, ask Grocery to create a shopping plan, then return to the home screen. Long-press the home screen, choose **Widgets**, and add **Tabby groceries**. The widget refreshes immediately whenever the installed Tabby app receives a new shopping plan.

For a local SpacetimeDB server on the Android emulator, publish the updated module locally, then build with the emulator host address:

```bash
spacetime dev tabby --server local --yes
VITE_SPACETIMEDB_URI=ws://10.0.2.2:3000 npm run android:sync
```

The debug Android manifest permits cleartext traffic for that local `ws://` connection. Release builds keep the normal secure network policy. The widget retains its last synchronized snapshot while the app is closed; remote household changes arrive the next time Tabby runs and receives its SpacetimeDB subscription.
