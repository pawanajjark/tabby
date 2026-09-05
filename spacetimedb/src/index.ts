import { TimeDuration } from 'spacetimedb';
import { schema, table, t, SenderError } from 'spacetimedb/server';

const residence = table(
  { name: 'residence', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    name: t.string(),
    address: t.string(),
    created_at: t.timestamp(),
  },
);

const flat = table(
  { name: 'flat', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    residence_id: t.u64().index('btree'),
    name: t.string(),
    flat_number: t.string(),
    created_at: t.timestamp(),
  },
);

const member = table(
  { name: 'member', public: true },
  {
    identity: t.identity().primaryKey(),
    flat_id: t.u64().index('btree'),
    display_name: t.string(),
  },
);

const pantryItem = table(
  { name: 'pantry_item', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    flat_id: t.u64().index('btree'),
    name: t.string().index('btree'),
    quantity: t.i32(),
    unit: t.string(),
    updated_by: t.identity(),
  },
);

const expense = table(
  { name: 'expense', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    flat_id: t.u64().index('btree'),
    title: t.string(),
    amount_paise: t.i64(),
    paid_by: t.identity(),
    category: t.string(),
    breakdown_json: t.string(),
  },
);

const expenseSplit = table(
  { name: 'expense_split', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    expense_id: t.u64().index('btree'),
    member_identity: t.identity().index('btree'),
    amount_paise: t.i64(),
    settled: t.bool(),
    reason: t.string(),
  },
);

const flatRule = table(
  { name: 'flat_rule', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    flat_id: t.u64().index('btree'),
    rule_type: t.string().index('btree'), // 'implicit' | 'explicit'
    title: t.string(),
    description: t.string(),
    created_by: t.identity(),
    created_at: t.timestamp(),
  },
);

const conversation = table(
  { name: 'conversation' },
  {
    id: t.string().primaryKey(),
    flat_id: t.u64().index('btree'),
    owner: t.identity().index('btree'),
    title: t.string(),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  },
);

const conversationMessage = table(
  { name: 'conversation_message' },
  {
    id: t.u64().primaryKey().autoInc(),
    conversation_id: t.string().index('btree'),
    owner: t.identity().index('btree'),
    role: t.string(),
    agent: t.string(),
    content: t.string(),
    created_at: t.timestamp(),
  },
);

const sharedMemory = table(
  { name: 'shared_memory', public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    flat_id: t.u64().index('btree'),
    subject_identity: t.identity().index('btree'),
    subject_name: t.string(),
    category: t.string().index('btree'),
    memory_key: t.string(),
    value: t.string(),
    source_message_id: t.u64(),
    updated_at: t.timestamp(),
  },
);

const aiConfig = table(
  { name: 'ai_config' },
  {
    owner: t.identity().primaryKey(),
    api_key: t.string(),
    model: t.string(),
    updated_at: t.timestamp(),
  },
);

const aiVerification = table(
  { name: 'ai_verification' },
  {
    owner: t.identity().primaryKey(),
    verified_at: t.timestamp(),
  },
);

const spacetimedb = schema({
  residence,
  flat,
  member,
  pantryItem,
  expense,
  expenseSplit,
  flatRule,
  conversation,
  conversationMessage,
  sharedMemory,
  aiConfig,
  aiVerification,
});

export default spacetimedb;

const aiStatusRow = t.row('AiStatus', {
  configured: t.bool(),
  verified: t.bool(),
  model: t.string(),
});

export const my_conversations = spacetimedb.view(
  { name: 'my_conversations', public: true },
  t.array(conversation.rowType),
  ctx => [...ctx.db.conversation.owner.filter(ctx.sender)],
);

export const my_conversation_messages = spacetimedb.view(
  { name: 'my_conversation_messages', public: true },
  t.array(conversationMessage.rowType),
  ctx => [...ctx.db.conversationMessage.owner.filter(ctx.sender)],
);

export const my_ai_status = spacetimedb.view(
  { name: 'my_ai_status', public: true },
  t.option(aiStatusRow),
  ctx => {
    const config = ctx.db.aiConfig.owner.find(ctx.sender);
    return config
      ? { configured: true, verified: ctx.db.aiVerification.owner.find(ctx.sender) !== null, model: config.model }
      : undefined;
  },
);

function defaultMemberName(identityHex: string) {
  return `Housemate ${identityHex.slice(0, 6)}`;
}

function ensureDefaultResidenceAndFlat(ctx: any): { residenceId: bigint; flatId: bigint } {
  let residences = [...ctx.db.residence.iter()];
  if (residences.length === 0) {
    const r1 = ctx.db.residence.insert({
      id: 0n,
      name: 'Palm Grove Residency',
      address: '12th Main Road, Indiranagar, Bengaluru',
      created_at: ctx.timestamp,
    });
    const r2 = ctx.db.residence.insert({
      id: 0n,
      name: 'Greenwood Heights',
      address: 'Outer Ring Road, Bellandur, Bengaluru',
      created_at: ctx.timestamp,
    });
    const r3 = ctx.db.residence.insert({
      id: 0n,
      name: 'Silver Oak Enclave',
      address: 'Koramangala 4th Block, Bengaluru',
      created_at: ctx.timestamp,
    });
    residences = [r1, r2, r3];
  }

  let flats = [...ctx.db.flat.iter()];
  if (flats.length === 0) {
    const r1Id = residences[0].id;
    const r2Id = residences[1]?.id || residences[0].id;
    const r3Id = residences[2]?.id || residences[0].id;

    const f1 = ctx.db.flat.insert({
      id: 0n,
      residence_id: r1Id,
      name: 'Sunshine Haven',
      flat_number: 'Flat 402',
      created_at: ctx.timestamp,
    });
    const f2 = ctx.db.flat.insert({
      id: 0n,
      residence_id: r1Id,
      name: 'Garden Suite',
      flat_number: 'Flat 104',
      created_at: ctx.timestamp,
    });
    const f3 = ctx.db.flat.insert({
      id: 0n,
      residence_id: r2Id,
      name: 'Skyline Loft',
      flat_number: 'Flat 801',
      created_at: ctx.timestamp,
    });
    const f4 = ctx.db.flat.insert({
      id: 0n,
      residence_id: r3Id,
      name: 'Cedar Court',
      flat_number: 'Flat 205',
      created_at: ctx.timestamp,
    });
    flats = [f1, f2, f3, f4];
  }

  return { residenceId: residences[0].id, flatId: flats[0].id };
}

export const on_connect = spacetimedb.clientConnected(ctx => {
  const { flatId } = ensureDefaultResidenceAndFlat(ctx);
  if (ctx.db.member.identity.find(ctx.sender) === null) {
    ctx.db.member.insert({
      identity: ctx.sender,
      flat_id: flatId,
      display_name: defaultMemberName(ctx.sender.toHexString()),
    });
  }
});

export const join_flat = spacetimedb.reducer(
  { flat_id: t.u64(), display_name: t.string() },
  (ctx, { flat_id, display_name }) => {
    const name = display_name.trim() || defaultMemberName(ctx.sender.toHexString());
    const targetFlat = ctx.db.flat.id.find(flat_id);
    if (!targetFlat) throw new SenderError('Selected flat not found.');
    const current = ctx.db.member.identity.find(ctx.sender);
    if (current) {
      ctx.db.member.identity.update({ ...current, flat_id, display_name: name });
    } else {
      ctx.db.member.insert({ identity: ctx.sender, flat_id, display_name: name });
    }
  },
);

export const create_and_join_flat = spacetimedb.reducer(
  { residence_id: t.u64(), flat_name: t.string(), flat_number: t.string(), display_name: t.string() },
  (ctx, args) => {
    const flatName = args.flat_name.trim() || 'My Flat';
    const flatNumber = args.flat_number.trim() || '101';
    const name = args.display_name.trim() || defaultMemberName(ctx.sender.toHexString());
    const res = ctx.db.residence.id.find(args.residence_id);
    if (!res) throw new SenderError('Residence not found.');
    const newFlat = ctx.db.flat.insert({
      id: 0n,
      residence_id: args.residence_id,
      name: flatName,
      flat_number: flatNumber,
      created_at: ctx.timestamp,
    });
    const current = ctx.db.member.identity.find(ctx.sender);
    if (current) {
      ctx.db.member.identity.update({ ...current, flat_id: newFlat.id, display_name: name });
    } else {
      ctx.db.member.insert({ identity: ctx.sender, flat_id: newFlat.id, display_name: name });
    }
  },
);

export const create_residence = spacetimedb.reducer(
  { name: t.string(), address: t.string() },
  (ctx, { name, address }) => {
    const cleanName = name.trim();
    if (!cleanName) throw new SenderError('Residence name is required.');
    ctx.db.residence.insert({
      id: 0n,
      name: cleanName,
      address: address.trim() || 'Bengaluru',
      created_at: ctx.timestamp,
    });
  },
);

export const update_residence_flat = spacetimedb.reducer(
  { residence_name: t.string(), address: t.string(), flat_name: t.string(), flat_number: t.string() },
  (ctx, args) => {
    const { residenceId, flatId } = ensureDefaultResidenceAndFlat(ctx);
    const currentRes = ctx.db.residence.id.find(residenceId);
    if (currentRes) {
      ctx.db.residence.id.update({
        ...currentRes,
        name: args.residence_name.trim() || currentRes.name,
        address: args.address.trim() || currentRes.address,
      });
    }
    const currentFlat = ctx.db.flat.id.find(flatId);
    if (currentFlat) {
      ctx.db.flat.id.update({
        ...currentFlat,
        name: args.flat_name.trim() || currentFlat.name,
        flat_number: args.flat_number.trim() || currentFlat.flat_number,
      });
    }
  },
);

export const set_display_name = spacetimedb.reducer(
  { display_name: t.string() },
  (ctx, { display_name }) => {
    const name = display_name.trim();
    if (!name) throw new SenderError('Please choose a display name.');
    const { flatId } = ensureDefaultResidenceAndFlat(ctx);
    const current = ctx.db.member.identity.find(ctx.sender);
    if (current) {
      ctx.db.member.identity.update({ ...current, display_name: name });
    } else {
      ctx.db.member.insert({ identity: ctx.sender, flat_id: flatId, display_name: name });
    }
  },
);

export const upsert_flat_rule = spacetimedb.reducer(
  {
    id: t.u64(),
    rule_type: t.string(),
    title: t.string(),
    description: t.string(),
  },
  (ctx, args) => {
    const { flatId } = ensureDefaultResidenceAndFlat(ctx);
    const title = args.title.trim();
    const description = args.description.trim();
    const ruleType = ['implicit', 'explicit'].includes(args.rule_type) ? args.rule_type : 'explicit';
    if (!title) throw new SenderError('Rule title is required.');

    if (args.id > 0n) {
      const existing = ctx.db.flatRule.id.find(args.id);
      if (existing) {
        ctx.db.flatRule.id.update({
          ...existing,
          rule_type: ruleType,
          title,
          description,
        });
        return;
      }
    }

    ctx.db.flatRule.insert({
      id: 0n,
      flat_id: flatId,
      rule_type: ruleType,
      title,
      description,
      created_by: ctx.sender,
      created_at: ctx.timestamp,
    });
  },
);

export const delete_flat_rule = spacetimedb.reducer(
  { id: t.u64() },
  (ctx, { id }) => {
    if (ctx.db.flatRule.id.find(id)) {
      ctx.db.flatRule.id.delete(id);
    }
  },
);

export const create_conversation = spacetimedb.reducer(
  { conversation_id: t.string(), title: t.string() },
  (ctx, { conversation_id, title }) => {
    const id = conversation_id.trim();
    if (!id || id.length > 80) throw new SenderError('Invalid conversation ID.');
    if (ctx.db.conversation.id.find(id)) throw new SenderError('Conversation already exists.');
    const { flatId } = ensureDefaultResidenceAndFlat(ctx);
    ctx.db.conversation.insert({
      id,
      flat_id: flatId,
      owner: ctx.sender,
      title: title.trim().slice(0, 80) || 'Home conversation',
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
  },
);

export const append_conversation_message = spacetimedb.reducer(
  {
    conversation_id: t.string(),
    role: t.string(),
    agent: t.string(),
    content: t.string(),
  },
  (ctx, args) => {
    const { flatId } = ensureDefaultResidenceAndFlat(ctx);
    let conversationRow = ctx.db.conversation.id.find(args.conversation_id);
    if (!conversationRow) {
      conversationRow = ctx.db.conversation.insert({
        id: args.conversation_id,
        flat_id: flatId,
        owner: ctx.sender,
        title: 'Home conversation',
        created_at: ctx.timestamp,
        updated_at: ctx.timestamp,
      });
    } else if (conversationRow.owner.toHexString() !== ctx.sender.toHexString()) {
      throw new SenderError('Conversation not found.');
    }
    const content = args.content.trim();
    if (!content || content.length > 12_000) throw new SenderError('Message is empty or too long.');
    if (!['user', 'assistant'].includes(args.role)) throw new SenderError('Invalid message role.');
    if (!['tabby', 'general', 'grocery', 'chef', 'billing', 'context'].includes(args.agent)) {
      throw new SenderError('Invalid message agent.');
    }

    ctx.db.conversationMessage.insert({
      id: 0n,
      conversation_id: args.conversation_id,
      owner: ctx.sender,
      role: args.role,
      agent: args.agent,
      content,
      created_at: ctx.timestamp,
    });
    ctx.db.conversation.id.update({ ...conversationRow, updated_at: ctx.timestamp });
  },
);

export const set_ai_config = spacetimedb.reducer(
  { api_key: t.string(), model: t.string() },
  (ctx, { api_key, model }) => {
    const key = api_key.trim();
    const selectedModel = model.trim() || 'gpt-5.6-sol';
    if (!key) {
      const current = ctx.db.aiConfig.owner.find(ctx.sender);
      if (current) ctx.db.aiConfig.owner.delete(ctx.sender);
      const verification = ctx.db.aiVerification.owner.find(ctx.sender);
      if (verification) ctx.db.aiVerification.owner.delete(ctx.sender);
      return;
    }
    if (!key.startsWith('sk-') || key.length < 20) throw new SenderError('Enter a valid OpenAI API key.');
    if (selectedModel.length > 80) throw new SenderError('Model name is too long.');
    const current = ctx.db.aiConfig.owner.find(ctx.sender);
    const verification = ctx.db.aiVerification.owner.find(ctx.sender);
    if (verification) ctx.db.aiVerification.owner.delete(ctx.sender);
    const row = { owner: ctx.sender, api_key: key, model: selectedModel, updated_at: ctx.timestamp };
    if (current) ctx.db.aiConfig.owner.update(row);
    else ctx.db.aiConfig.insert(row);
  },
);

export const upsert_shared_memory = spacetimedb.reducer(
  {
    category: t.string(),
    memory_key: t.string(),
    value: t.string(),
    source_message_id: t.u64(),
  },
  (ctx, args) => {
    const safeCategories = ['diet', 'allergy', 'food_preference', 'routine', 'rule'];
    if (!safeCategories.includes(args.category)) throw new SenderError('That memory category cannot be shared.');
    const key = args.memory_key.trim().slice(0, 80);
    const value = args.value.trim().slice(0, 500);
    if (!key || !value) throw new SenderError('Shared memory needs a key and value.');
    const { flatId } = ensureDefaultResidenceAndFlat(ctx);
    const subject = ctx.db.member.identity.find(ctx.sender);
    const subjectName = subject?.display_name || defaultMemberName(ctx.sender.toHexString());
    const existing = [...ctx.db.sharedMemory.subject_identity.filter(ctx.sender)]
      .find(row => row.category === args.category && row.memory_key === key);

    if (existing) {
      ctx.db.sharedMemory.id.update({
        ...existing,
        flat_id: flatId,
        subject_name: subjectName,
        value,
        source_message_id: args.source_message_id,
        updated_at: ctx.timestamp,
      });
    } else {
      ctx.db.sharedMemory.insert({
        id: 0n,
        flat_id: flatId,
        subject_identity: ctx.sender,
        subject_name: subjectName,
        category: args.category,
        memory_key: key,
        value,
        source_message_id: args.source_message_id,
        updated_at: ctx.timestamp,
      });
    }
  },
);

export const add_pantry_item = spacetimedb.reducer(
  { name: t.string(), quantity: t.i32(), unit: t.string() },
  (ctx, { name, quantity, unit }) => {
    const cleanName = name.trim().toLowerCase();
    if (!cleanName || quantity === 0) throw new SenderError('Add an item and a non-zero quantity.');
    const { flatId } = ensureDefaultResidenceAndFlat(ctx);
    const existing = [...ctx.db.pantryItem.name.filter(cleanName)][0];
    if (existing) {
      ctx.db.pantryItem.id.update({
        ...existing,
        flat_id: flatId,
        quantity: Math.max(0, existing.quantity + quantity),
        unit: unit.trim() || existing.unit,
        updated_by: ctx.sender,
      });
    } else {
      ctx.db.pantryItem.insert({
        id: 0n,
        flat_id: flatId,
        name: cleanName,
        quantity: Math.max(0, quantity),
        unit: unit.trim() || 'items',
        updated_by: ctx.sender,
      });
    }
  },
);

export const record_expense = spacetimedb.reducer(
  { title: t.string(), amount_paise: t.i64() },
  (ctx, { title, amount_paise }) => {
    const cleanTitle = title.trim();
    if (!cleanTitle || amount_paise <= 0n) throw new SenderError('Add an expense name and an amount.');
    const { flatId } = ensureDefaultResidenceAndFlat(ctx);
    const members = [...ctx.db.member.iter()];
    if (members.length === 0) throw new SenderError('At least one roommate must join Tabby first.');
    const insertedExpense = ctx.db.expense.insert({
      id: 0n,
      flat_id: flatId,
      title: cleanTitle,
      amount_paise,
      paid_by: ctx.sender,
      category: 'general',
      breakdown_json: '',
    });
    const each = amount_paise / BigInt(members.length);
    const remainder = amount_paise % BigInt(members.length);
    members.forEach((roommate, index) => {
      ctx.db.expenseSplit.insert({
        id: 0n,
        expense_id: insertedExpense.id,
        member_identity: roommate.identity,
        amount_paise: each + (index === 0 ? remainder : 0n),
        settled: roommate.identity.toHexString() === ctx.sender.toHexString(),
        reason: 'Equal split',
      });
    });
  },
);

export const clear_all_data = spacetimedb.reducer(
  {},
  ctx => {
    for (const row of [...ctx.db.pantryItem.iter()]) ctx.db.pantryItem.id.delete(row.id);
    for (const row of [...ctx.db.expenseSplit.iter()]) ctx.db.expenseSplit.id.delete(row.id);
    for (const row of [...ctx.db.expense.iter()]) ctx.db.expense.id.delete(row.id);
    for (const row of [...ctx.db.sharedMemory.iter()]) ctx.db.sharedMemory.id.delete(row.id);
    for (const row of [...ctx.db.flatRule.iter()]) ctx.db.flatRule.id.delete(row.id);
    for (const row of [...ctx.db.conversationMessage.iter()]) ctx.db.conversationMessage.id.delete(row.id);
    for (const row of [...ctx.db.conversation.iter()]) ctx.db.conversation.id.delete(row.id);
    for (const row of [...ctx.db.flat.iter()]) ctx.db.flat.id.delete(row.id);
    for (const row of [...ctx.db.residence.iter()]) ctx.db.residence.id.delete(row.id);
    ensureDefaultResidenceAndFlat(ctx);
  },
);

function responseText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const data = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content.trim();
  if (typeof data.output_text === 'string') return data.output_text.trim();
  return (data.output ?? [])
    .flatMap(item => item.content ?? [])
    .filter(part => part.type === 'output_text' && typeof part.text === 'string')
    .map(part => part.text!.trim())
    .filter(Boolean)
    .join('\n');
}

export const run_ai = spacetimedb.procedure(
  {
    prompt: t.string(),
    instructions: t.string(),
    image_data_url: t.string(),
    json_mode: t.bool(),
  },
  t.string(),
  (ctx, args) => {
    const config = ctx.withTx(tx => tx.db.aiConfig.owner.find(tx.sender));
    if (!config) throw new SenderError('OpenAI is not configured. Add your API key in AI settings.');
    const prompt = args.prompt.trim();
    if (!prompt) throw new SenderError('AI prompt cannot be empty.');

    const messages: Array<{ role: string; content: unknown }> = [];
    if (args.instructions?.trim()) {
      messages.push({ role: 'system', content: args.instructions.trim() });
    }

    const imageDataUrl = args.image_data_url.trim();
    if (imageDataUrl) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const requestModel = config.model || 'gpt-5.6-sol';
    const requestBody: Record<string, unknown> = {
      model: requestModel,
      messages,
      max_tokens: 1800,
    };
    if (args.json_mode) requestBody.response_format = { type: 'json_object' };

    let response = ctx.http.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.api_key}`,
      },
      body: JSON.stringify(requestBody),
      timeout: TimeDuration.fromMillis(45_000),
    });

    if (response.status < 200 || response.status >= 300) {
      if (requestModel !== 'gpt-4o-mini' && (response.status === 404 || response.status === 400)) {
        requestBody.model = 'gpt-4o-mini';
        response = ctx.http.fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.api_key}`,
          },
          body: JSON.stringify(requestBody),
          timeout: TimeDuration.fromMillis(45_000),
        });
      }
    }

    if (response.status < 200 || response.status >= 300) {
      throw new SenderError(`OpenAI request failed with status ${response.status}.`);
    }
    const text = responseText(response.json());
    if (!text) throw new SenderError('OpenAI returned an empty response.');
    ctx.withTx(tx => {
      const current = tx.db.aiVerification.owner.find(tx.sender);
      const verification = { owner: tx.sender, verified_at: tx.timestamp };
      if (current) tx.db.aiVerification.owner.update(verification);
      else tx.db.aiVerification.insert(verification);
    });
    return text;
  },
);
