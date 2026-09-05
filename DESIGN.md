---
name: Tabby
description: "A calm, chat-first household operating surface with quietly coordinated specialist intelligence."
colors:
  ink: "#182234"
  muted: "#69758a"
  rule: "#dfe4ec"
  surface: "#fbfcfe"
  soft: "#f2f5f9"
  white: "#ffffff"
  navy: "#0b1426"
  navy-raised: "#131f35"
  outgoing-message: "#20304b"
  blue: "#2457e6"
  blue-dark: "#1943ba"
  grocery: "#27845c"
  chef: "#c65c2f"
  billing: "#7351c7"
  context: "#28718d"
  danger: "#b63e47"
typography:
  display:
    fontFamily: "Sora, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.06em"
  headline:
    fontFamily: "Sora, sans-serif"
    fontSize: "clamp(1rem, 2vw, 1.25rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.035em"
  title:
    fontFamily: "Sora, sans-serif"
    fontSize: "0.96rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "0.93rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: "Manrope, Segoe UI, sans-serif"
    fontSize: "0.64rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.09em"
rounded:
  subtle: "7px"
  control: "8px"
  context: "9px"
  field: "10px"
  card: "14px"
  dialog: "15px"
  pill: "999px"
spacing:
  xs: "7px"
  sm: "9px"
  md: "12px"
  lg: "18px"
  xl: "22px"
  xxl: "30px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "9px 18px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.blue-dark}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "9px 18px"
    typography: "{typography.label}"
  route-status:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.muted}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "32px"
    typography: "{typography.label}"
  composer:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "12px 12px 10px 15px"
  user-message:
    backgroundColor: "{colors.outgoing-message}"
    textColor: "{colors.white}"
    rounded: "14px 14px 3px 14px"
    padding: "13px 17px"
  result-card:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "0"
---

# Design System: Tabby

## Overview

**Creative North Star: "The Quiet Household Console"**

Tabby is a calm domestic command surface organized around one conversation. A midnight identity rail, a broad cool-white transcript, and a pale live-context panel make the product feel dependable and operational without becoming corporate, technical, cute, or gamified. The visual hierarchy should make asking a natural-language question feel faster than navigating to a tool.

Specialist intelligence is coordinated behind the conversation. Grocery, Chef, Billing, and House context may identify themselves in a small routing status, a narrow message label, or the inline result they produce; they are not persistent destinations. TabbyBrain is never exposed as a visible agent, tab, shortcut, or roster entry. Its private-memory work is represented only through precise privacy language and deliberately limited shared household context.

The interface is restrained rather than empty: firm one-pixel rules establish structure, compact labels clarify state, and selective shadows lift only interactive or resolved work. Every result must remain grounded in live household data, including truthful empty and offline states.

**Key Characteristics:**

- Chat-first, with the composer and transcript as the dominant operating surface.
- Midnight-blue framing around a cool, quiet content field.
- Crisp cobalt actions and narrowly applied specialist signals.
- Compact sans-serif typography, tabular numbers, and strong one-pixel rules.
- Responsive context that moves from a persistent panel to an accessible drawer.
- Calm, direct, domestic language with no emojis or invented household data.

**The Conversation-First Rule.** New household capabilities enter the interface through natural-language intent and resolve inline; do not promote them into primary navigation.

**The Hidden-Routing Rule.** Show the specialist only when its work is relevant, and never reveal TabbyBrain or private memory as an agent or destination.

## Colors

The palette is a cool operational neutral system with one decisive cobalt action color and four tightly scoped specialist signals.

### Primary

- **Crisp Cobalt:** The primary action, general Tabby routing signal, active link treatment, selection color, checkbox accent, and focus emphasis.
- **Deep Cobalt:** The hover state for primary actions; it reinforces action without changing the interface's overall temperature.

### Secondary

- **Grocery Green:** Grocery route dots, agent labels, and pantry quantities.
- **Chef Terracotta:** Chef route dots, labels, and recipe metadata.
- **Billing Violet:** Billing route dots and agent labels.
- **Context Teal:** House-context route dots, labels, and shared-memory categories.
- **Danger Red:** Error feedback only, primarily destructive or failed toast states.

### Neutral

- **Midnight Navy:** The identity rail and the strongest branded frame.
- **Raised Navy:** Subtle hover feedback within the rail.
- **Cool White Surface:** The main transcript canvas and default page field.
- **Soft Context:** Low-contrast badges and the context panel's tonal separation.
- **White:** Composers, result cards, dialogs, and bordered controls that must lift from the canvas.
- **Ink:** Primary text and headings.
- **Muted Slate:** Supporting copy, metadata, empty states, and inactive controls.
- **Cool Rule:** One-pixel boundaries, dividers, and card outlines.
- **Outgoing Navy:** The user's message bubble and dark success toast surface.

**The Narrow Signal Rule.** Specialist colors identify ownership in dots, labels, metadata, and small numeric accents; they never become large backgrounds or competing navigation zones.

**The Neutral Canvas Rule.** Most of every screen remains navy, cool white, soft gray, and ink so content and current state—not decoration—carry attention.

## Typography

**Display Font:** Sora (with sans-serif fallback)  
**Body Font:** Manrope (with Segoe UI and sans-serif fallbacks)  
**Label Font:** Manrope (with Segoe UI and sans-serif fallbacks)

**Character:** Sora gives the wordmark and structural headings a compact, confident silhouette. Manrope keeps conversation, controls, metadata, and dense household results clear and approachable. The pairing should feel precise and helpful, never playful.

### Hierarchy

- **Display:** Reserved for the Tabby wordmark; heavy, tightly tracked, and never used for page-scale marketing headlines.
- **Headline:** Used for workspace and dialog headings with compact line height and gently tightened tracking.
- **Title:** Used for result-card headings and recipe titles where a concise unit needs stronger scanning priority.
- **Body:** Used for the transcript and primary explanations; the conversation is limited to a readable maximum width (820px) instead of spanning the viewport.
- **Interface:** Supporting copy and controls typically sit between 0.66rem and 0.79rem, with weights from 600 to 750 according to importance.
- **Label:** Uppercase agent names and section labels use heavy weight, wide tracking, and short phrases only.
- **Numeric metadata:** Counts, money, quantities, step numbers, and time-like metadata use tabular numerals.

**The Two-Family Rule.** Use Sora only for brand and structural emphasis; use Manrope for everything read, entered, or acted upon.

**The Small-Type Rule.** Compact metadata is acceptable only when it remains secondary, high-contrast enough to read, and paired with a clear primary line.

## Layout

The desktop workspace fills the viewport and uses a three-column grid: a fixed identity rail (236px), a flexible conversation column, and a live house-context panel (306px). The conversation header, transcript, and composer form a vertical grid; transcript content and composer controls share an 820px maximum width so the interaction reads as one continuous column. The composer anchors the bottom of the conversation shell while the transcript scrolls independently.

At 1120px and below, the rail contracts to 220px and the house-context panel becomes a right-side drawer, up to 340px wide or 90vw. A visible Context control exposes it; the closed drawer is hidden and inert, opening moves focus to its Close control, and closing returns focus to the toggle when needed.

At 740px and below, the rail collapses to a compact midnight wordmark bar and the conversation becomes a single full-width column. The routing guide and rail utilities disappear; profile and AI settings move into the context drawer. Horizontal padding reduces to 15px in the transcript and 12px around the composer. User messages may occupy up to 88% of the width. Recipe and bill-split grids stack into one column, result rows reflow vertically, and the drawer may use up to 94vw.

Spacing follows a compact operational rhythm: 7–12px for control internals and metadata, 18–22px for cards and panels, and 28–42px for major section starts. One-pixel rules are the default separator. Preserve the 320px minimum supported width, 200% zoom readability, and content reflow without horizontal scrolling.

**The Single-Column Core Rule.** Every responsive state preserves one uninterrupted transcript-to-composer path; secondary context may move, but the conversation never becomes one tab among peers.

## Elevation & Depth

Tabby is flat by default and uses tonal layering plus firm rules for most structure. Shadows are structural and sparse: resolved agent cards use a low ambient lift (`0 8px 28px rgba(16, 31, 56, 0.06)`), the composer uses a stronger working-surface shadow (`0 14px 38px rgba(18, 31, 53, 0.12)`), dialogs use the modal shadow (`0 24px 65px rgba(5, 14, 31, 0.17)`), toasts use a compact overlay shadow (`0 12px 35px rgba(4, 12, 27, 0.24)`), and the responsive context drawer casts leftward separation (`-24px 0 60px rgba(7, 17, 35, 0.2)`). Composer focus shifts its border to cobalt and slightly recolors the same shadow rather than adding a glow-heavy effect.

**The Flat-Until-Useful Rule.** Navigation, transcript text, and context rows stay flat; elevation is reserved for input, resolved work, drawers, dialogs, and transient feedback.

## Shapes

The form language uses gently curved rectangles with precise borders. Compact controls and avatars use 7–10px corners, composers and result cards use 14px corners, and dialogs use 15px corners. Full pills are limited to state badges. The outgoing message bubble has one tightened lower corner, creating a directional tail without illustration or ornament. Circles are reserved for status dots.

**The Restrained-Radius Rule.** Keep most corners between 7px and 15px; do not turn cards, fields, or navigation into oversized capsules.

**The One-Pixel Rule.** Use cool one-pixel borders and dividers to organize dense household information before reaching for shadows or additional containers.

## Components

### Navigation and Identity Rail

- **Character:** Quiet, branded framing rather than a tool switcher.
- **Desktop:** The midnight rail contains the wordmark, one-line positioning statement, a three-step explanation of routing, and low-emphasis profile/settings actions at the bottom.
- **Mobile:** It collapses to the wordmark bar. Profile and AI settings remain available from the context drawer.
- **Constraint:** Do not add persistent Grocery, Chef, Billing, Context, or TabbyBrain destinations. Specialist work is summoned by chat.

### Route Status

- **Character:** A compact preview of where the current request is going.
- **Shape:** A soft neutral pill with a small colored signal dot.
- **Behavior:** Begin in Ready, switch to a working state before the relevant result resolves, and settle on Tabby, Grocery, Chef, Billing, or Context. The working dot pulses; the label is announced through a polite live region.
- **Motion:** The pulse uses a restrained 1.1s ease-in-out cycle. Under reduced-motion preferences it resolves nearly instantly without repeated animation.

### Messages

- **Assistant:** Left-aligned, full-width readable text with a small uppercase owner label. General responses remain Tabby; routed specialist responses use only their assigned signal color.
- **User:** Right-aligned outgoing navy bubble with white text and the asymmetric lower corner.
- **Behavior:** New messages scroll the transcript to the latest item. Long content wraps anywhere, and paragraph whitespace is preserved.
- **Pending and errors:** Keep state in the conversation itself; failures return a concise message owned by the relevant route rather than breaking into a separate page.

### Routed Result Cards

- **Character:** Grounded household work, not decorative dashboards.
- **Container:** White surface, one-pixel cool border, 14px corners, low ambient shadow.
- **Structure:** A concise heading and count/summary lead into ruled rows or a two-column grid. Shopping rows place quantity and action together; recipe cards use Chef metadata; bill splits use tabular amounts.
- **Responsive behavior:** Two-column recipe and split layouts become single columns on mobile. Row actions reflow below their description when space is constrained.
- **State:** Inline actions change to completed language and disable after success. Connectivity failures use an error toast and do not claim the backend action occurred.

### Composer

- **Character:** The most prominent interactive surface on every viewport.
- **Container:** White, bordered, 14px corners, and lifted above the transcript with a structural shadow.
- **Field:** Borderless textarea with a clear household-oriented prompt, a 3000-character limit, and automatic growth up to 160px.
- **Actions:** Receipt attachment is secondary; Send is the cobalt primary button. Selected filenames truncate rather than widening the layout.
- **Keyboard:** Enter sends; Shift+Enter inserts a line break. All controls retain visible focus treatment.
- **Focus:** Focus within changes the border to a soft cobalt and recolors the existing shadow.
- **Privacy:** The persistent note below the composer states that personal chat is not shared and only explicit household preferences enter shared context.

### House Context

- **Character:** Useful shared facts, visibly separate from private conversation.
- **Desktop:** A persistent pale panel containing People, Shared memory, and Pantry now sections with live counts and honest empty states.
- **Responsive:** Becomes an accessible right-side drawer below 1120px; the header toggle reflects `aria-expanded`, the panel is inert while closed, and focus is deliberately managed.
- **Content:** Person rows use initial avatars, shared-memory items use restrained bordered cards, and pantry rows use tabular quantities with a Grocery accent.
- **Constraint:** Display only concise household-safe context. Never reproduce raw private conversation or expose private-memory records.

### Buttons and Fields

- **Primary:** Cobalt fill, white text, compact 8px corners, and a deep-cobalt hover state.
- **Secondary:** White surface, cool border, slate text, and a soft-neutral hover state.
- **Quiet:** Transparent rail actions gain a subtle raised-navy background on hover.
- **Inline:** Result actions begin as pale cobalt controls and invert to cobalt on hover.
- **Focus:** Buttons, inputs, and textareas use a three-pixel translucent cobalt outline with a two-pixel offset.
- **Disabled:** Reduce opacity while removing the pointer cursor; preserve the completed label.
- **Touch:** Mobile interactive targets, including Send, Attach receipt, route/context controls, and close actions, are at least 44px high.

### Dialogs and Feedback

- **Dialogs:** White modal surface, 15px corners, strong shadow, dark navy backdrop, and a maximum width of 540px. Headings and actions remain compact, with forms arranged in a clear vertical rhythm.
- **Inputs:** Cool-white field fill, one-pixel border, 8px corners, and a 42px minimum height. Checkbox accents use the primary cobalt.
- **Toasts:** Bottom-right on larger screens, dark outgoing-navy for success and danger red for error. Keep copy concise and announce it through a polite live region.

## Do's and Don'ts

### Do:

- **Do** keep the transcript and composer visually and behaviorally primary on every viewport.
- **Do** reveal Grocery, Chef, Billing, or Context identity only in routing state, message labels, and relevant inline results.
- **Do** keep TabbyBrain invisible while preserving explicit privacy and household-sharing explanations.
- **Do** use live counts, truthful empty states, offline status, and current backend data instead of fabricated examples.
- **Do** preserve keyboard sending, visible focus, drawer focus management, 44px mobile targets, 200% zoom reflow, and reduced-motion behavior.
- **Do** use specialist colors as narrow ownership signals and tabular numerals for quantities, currency, and counts.

### Don't:

- **Don't** replace the chat-first workspace with primary tabs, a dashboard grid, or a persistent agent roster.
- **Don't** expose TabbyBrain, raw personal conversations, or private memory to housemates.
- **Don't** claim that pantry, billing, profile, or shared-context actions succeeded unless the current connection and reducer result support that claim.
- **Don't** invent roommates, pantry items, expenses, preferences, testimonials, claims, or photographic content.
- **Don't** use emojis, mascots, playful gamification, decorative gradients, or large specialist-colored surfaces.
- **Don't** use oversized pill shapes or heavy shadows where a one-pixel rule and tonal surface already establish hierarchy.
