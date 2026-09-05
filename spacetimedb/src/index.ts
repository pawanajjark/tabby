import { schema, table, t } from 'spacetimedb/server';

const spacetimedb = schema({
  member: table(
    { name: 'member', public: true },
    {
      identity: t.identity().primaryKey(),
      display_name: t.string(),
    },
  ),
  pantry_item: table(
    { name: 'pantry_item', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      name: t.string().index('btree'),
      quantity: t.i32(),
      unit: t.string(),
      updated_by: t.identity(),
    },
  ),
  expense: table(
    { name: 'expense', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      title: t.string(),
      amount_paise: t.i64(),
      paid_by: t.identity(),
    },
  ),
  expense_split: table(
    { name: 'expense_split', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      expense_id: t.u64().index('btree'),
      member_identity: t.identity().index('btree'),
      amount_paise: t.i64(),
      settled: t.bool(),
    },
  ),
  chat_message: table(
    { name: 'chat_message', public: true },
    {
      id: t.u64().primaryKey().autoInc(),
      body: t.string(),
      sender: t.identity(),
      kind: t.string(),
    },
  ),
});

export default spacetimedb;

export const on_connect = spacetimedb.clientConnected(ctx => {
  if (ctx.db.member.identity.find(ctx.sender) === null) {
    ctx.db.member.insert({ identity: ctx.sender, display_name: 'Roommate' });
  }
});

export const set_display_name = spacetimedb.reducer(
  { display_name: t.string() },
  (ctx, { display_name }) => {
    const name = display_name.trim();
    if (!name) throw new Error('Please choose a display name.');
    const member = ctx.db.member.identity.find(ctx.sender);
    if (member) ctx.db.member.identity.update({ ...member, display_name: name });
    else ctx.db.member.insert({ identity: ctx.sender, display_name: name });
  },
);

export const add_pantry_item = spacetimedb.reducer(
  { name: t.string(), quantity: t.i32(), unit: t.string() },
  (ctx, { name, quantity, unit }) => {
    const cleanName = name.trim().toLowerCase();
    if (!cleanName || quantity === 0) throw new Error('Add an item and a non-zero quantity.');
    const existing = [...ctx.db.pantry_item.name.filter(cleanName)][0];
    if (existing) {
      ctx.db.pantry_item.id.update({
        ...existing,
        quantity: existing.quantity + quantity,
        unit: unit.trim() || existing.unit,
        updated_by: ctx.sender,
      });
    } else {
      ctx.db.pantry_item.insert({ id: 0n, name: cleanName, quantity, unit: unit.trim() || 'items', updated_by: ctx.sender });
    }
  },
);

export const record_expense = spacetimedb.reducer(
  { title: t.string(), amount_paise: t.i64() },
  (ctx, { title, amount_paise }) => {
    const cleanTitle = title.trim();
    if (!cleanTitle || amount_paise <= 0n) throw new Error('Add an expense name and an amount.');
    const members = [...ctx.db.member.iter()];
    if (members.length === 0) throw new Error('At least one roommate must join Tabby first.');
    const expense = ctx.db.expense.insert({ id: 0n, title: cleanTitle, amount_paise, paid_by: ctx.sender });
    const each = amount_paise / BigInt(members.length);
    const remainder = amount_paise % BigInt(members.length);
    members.forEach((member, index) => {
      ctx.db.expense_split.insert({
        id: 0n,
        expense_id: expense.id,
        member_identity: member.identity,
        amount_paise: each + (index === 0 ? remainder : 0n),
        settled: member.identity === ctx.sender,
      });
    });
  },
);

export const add_chat_message = spacetimedb.reducer(
  { body: t.string(), kind: t.string() },
  (ctx, { body, kind }) => {
    const cleanBody = body.trim();
    if (!cleanBody) throw new Error('Message cannot be empty.');
    ctx.db.chat_message.insert({ id: 0n, body: cleanBody, sender: ctx.sender, kind });
  },
);
