import { ScheduleAt, TimeDuration } from 'spacetimedb';
import { schema, table, t, SenderError } from 'spacetimedb/server';

const residence = table(
  { name: 'residence' },
  {
    id: t.u64().primaryKey().autoInc(),
    name: t.string(),
    address: t.string(),
    created_at: t.timestamp(),
  },
);

const flat = table(
  { name: 'flat' },
  {
    id: t.u64().primaryKey().autoInc(),
    residence_id: t.u64().index('btree'),
    name: t.string(),
    flat_number: t.string(),
    created_at: t.timestamp(),
  },
);

const member = table(
  { name: 'member' },
  {
    identity: t.identity().primaryKey(),
    flat_id: t.u64().index('btree'),
    display_name: t.string(),
  },
);

const pantryItem = table(
  { name: 'pantry_item' },
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
  { name: 'expense' },
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
  { name: 'expense_split' },
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
  { name: 'flat_rule' },
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
  { name: 'shared_memory' },
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

// Additive tables preserve the published legacy shapes while enabling multiple
// homes, invitations, richer pantry data, reviewed bills, and reminders.
const homeMembership = table(
  { name: 'home_membership' },
  {
    id: t.u64().primaryKey().autoInc(),
    identity: t.identity().index('btree'),
    flat_id: t.u64().index('btree'),
    display_name: t.string(),
    role: t.string(),
    active: t.bool(),
    joined_at: t.timestamp(),
  },
);

const homeInvitation = table(
  { name: 'home_invitation' },
  {
    code: t.string().primaryKey(),
    flat_id: t.u64().index('btree'),
    invited_by: t.identity().index('btree'),
    recipient: t.string(),
    status: t.string(),
    expires_at: t.timestamp(),
    created_at: t.timestamp(),
  },
);

const homeSettings = table(
  { name: 'home_settings' },
  {
    flat_id: t.u64().primaryKey(),
    quiet_hours_start: t.string(),
    quiet_hours_end: t.string(),
    default_billing_split: t.string(),
    invites_enabled: t.bool(),
    updated_by: t.identity(),
    updated_at: t.timestamp(),
  },
);

const pantryItemDetail = table(
  { name: 'pantry_item_detail' },
  {
    pantry_item_id: t.u64().primaryKey(),
    flat_id: t.u64().index('btree'),
    category: t.string().index('btree'),
    location: t.string(),
    low_stock_threshold: t.i32(),
    use_soon: t.bool(),
    updated_at: t.timestamp(),
  },
);

const billReview = table(
  { name: 'bill_review' },
  {
    id: t.u64().primaryKey().autoInc(),
    flat_id: t.u64().index('btree'),
    title: t.string(),
    amount_paise: t.i64(),
    paid_by: t.identity(),
    expense_date: t.timestamp(),
    category: t.string(),
    status: t.string(),
    created_by: t.identity().index('btree'),
    created_at: t.timestamp(),
    updated_at: t.timestamp(),
  },
);

const billAllocation = table(
  { name: 'bill_allocation' },
  {
    id: t.u64().primaryKey().autoInc(),
    bill_review_id: t.u64().index('btree'),
    flat_id: t.u64().index('btree'),
    member_identity: t.identity().index('btree'),
    amount_paise: t.i64(),
    exempt: t.bool(),
    reason: t.string(),
  },
);

const billLine = table(
  { name: 'bill_line' },
  {
    id: t.u64().primaryKey().autoInc(),
    bill_review_id: t.u64().index('btree'),
    flat_id: t.u64().index('btree'),
    line_key: t.string().index('btree'),
    label: t.string(),
    amount_paise: t.i64(),
    position: t.u32(),
  },
);

const billLineAllocation = table(
  { name: 'bill_line_allocation' },
  {
    id: t.u64().primaryKey().autoInc(),
    bill_review_id: t.u64().index('btree'),
    bill_line_id: t.u64().index('btree'),
    flat_id: t.u64().index('btree'),
    member_identity: t.identity().index('btree'),
    amount_paise: t.i64(),
    exempt: t.bool(),
    reason: t.string(),
  },
);

const reminder = table(
  { name: 'reminder' },
  {
    id: t.u64().primaryKey().autoInc(),
    flat_id: t.u64().index('btree'),
    title: t.string(),
    due_at: t.timestamp(),
    completed: t.bool(),
    created_by: t.identity().index('btree'),
    created_at: t.timestamp(),
  },
);

const reminderJob = table(
  { name: 'reminder_job' },
  {
    id: t.u64().primaryKey().autoInc(),
    scheduled_at: t.scheduleAt(),
    reminder_id: t.u64().index('btree'),
  },
);

const reminderDelivery = table(
  { name: 'reminder_delivery' },
  {
    id: t.u64().primaryKey().autoInc(),
    reminder_id: t.u64().index('btree'),
    flat_id: t.u64().index('btree'),
    title: t.string(),
    delivered_at: t.timestamp(),
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
  homeMembership,
  homeInvitation,
  homeSettings,
  pantryItemDetail,
  billReview,
  billAllocation,
  billLine,
  billLineAllocation,
  reminder,
  reminderJob,
  reminderDelivery,
});

export default spacetimedb;

const aiStatusRow = t.row('AiStatus', {
  configured: t.bool(),
  verified: t.bool(),
  model: t.string(),
});

const invitationPreviewRow = t.row('InvitationPreview', {
  code: t.string(),
  flat_id: t.u64(),
  flat_name: t.string(),
  flat_number: t.string(),
  residence_name: t.string(),
  invited_by_name: t.string(),
  member_count: t.u32(),
});

const scopedMemberRow = t.row('ScopedMember', {
  identity: t.identity(),
  flat_id: t.u64(),
  display_name: t.string(),
});

function callerHomeIds(ctx: any): bigint[] {
  const ids = new Set<bigint>();
  for (const row of ctx.db.homeMembership.identity.filter(ctx.sender)) ids.add(row.flat_id);
  const legacy = ctx.db.member.identity.find(ctx.sender);
  if (legacy) ids.add(legacy.flat_id);
  return [...ids];
}

export const my_residences = spacetimedb.view(
  { name: 'my_residences', public: true },
  t.array(residence.rowType),
  ctx => {
    const rows = [];
    const seen = new Set<bigint>();
    for (const flatId of callerHomeIds(ctx)) {
      const home = ctx.db.flat.id.find(flatId);
      if (!home || seen.has(home.residence_id)) continue;
      const row = ctx.db.residence.id.find(home.residence_id);
      if (row) {
        seen.add(row.id);
        rows.push(row);
      }
    }
    return rows;
  },
);

export const my_homes = spacetimedb.view(
  { name: 'my_homes', public: true },
  t.array(flat.rowType),
  ctx => callerHomeIds(ctx).flatMap(flatId => {
    const row = ctx.db.flat.id.find(flatId);
    return row ? [row] : [];
  }),
);

export const my_members = spacetimedb.view(
  { name: 'my_members', public: true },
  t.array(scopedMemberRow),
  ctx => {
    const rows: Array<{ identity: any; flat_id: bigint; display_name: string }> = [];
    const seen = new Set<string>();
    for (const flatId of callerHomeIds(ctx)) {
      for (const membership of ctx.db.homeMembership.flat_id.filter(flatId)) {
        const key = `${membership.identity.toHexString()}:${flatId}`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push({
            identity: membership.identity,
            flat_id: flatId,
            display_name: membership.display_name,
          });
        }
      }
      for (const legacy of ctx.db.member.flat_id.filter(flatId)) {
        const key = `${legacy.identity.toHexString()}:${flatId}`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push(legacy);
        }
      }
    }
    return rows;
  },
);

export const my_home_memberships = spacetimedb.view(
  { name: 'my_home_memberships', public: true },
  t.array(homeMembership.rowType),
  ctx => callerHomeIds(ctx).flatMap(flatId => [...ctx.db.homeMembership.flat_id.filter(flatId)]),
);

export const my_pantry_items = spacetimedb.view(
  { name: 'my_pantry_items', public: true },
  t.array(pantryItem.rowType),
  ctx => callerHomeIds(ctx).flatMap(flatId => [...ctx.db.pantryItem.flat_id.filter(flatId)]),
);

export const my_pantry_item_details = spacetimedb.view(
  { name: 'my_pantry_item_details', public: true },
  t.array(pantryItemDetail.rowType),
  ctx => callerHomeIds(ctx).flatMap(flatId => [...ctx.db.pantryItemDetail.flat_id.filter(flatId)]),
);

export const my_expenses = spacetimedb.view(
  { name: 'my_expenses', public: true },
  t.array(expense.rowType),
  ctx => callerHomeIds(ctx).flatMap(flatId => [...ctx.db.expense.flat_id.filter(flatId)]),
);

export const my_expense_splits = spacetimedb.view(
  { name: 'my_expense_splits', public: true },
  t.array(expenseSplit.rowType),
  ctx => callerHomeIds(ctx).flatMap(flatId =>
    [...ctx.db.expense.flat_id.filter(flatId)]
      .flatMap(row => [...ctx.db.expenseSplit.expense_id.filter(row.id)]),
  ),
);

export const my_flat_rules = spacetimedb.view(
  { name: 'my_flat_rules', public: true },
  t.array(flatRule.rowType),
  ctx => callerHomeIds(ctx).flatMap(flatId => [...ctx.db.flatRule.flat_id.filter(flatId)]),
);

export const my_shared_memories = spacetimedb.view(
  { name: 'my_shared_memories', public: true },
  t.array(sharedMemory.rowType),
  ctx => callerHomeIds(ctx).flatMap(flatId => [...ctx.db.sharedMemory.flat_id.filter(flatId)]),
);

export const my_home_settings = spacetimedb.view(
  { name: 'my_home_settings', public: true },
  t.array(homeSettings.rowType),
  ctx => callerHomeIds(ctx).flatMap(flatId => {
    const row = ctx.db.homeSettings.flat_id.find(flatId);
    return row ? [row] : [];
  }),
);

export const my_bill_reviews = spacetimedb.view(
  { name: 'my_bill_reviews', public: true },
  t.array(billReview.rowType),
  ctx => callerHomeIds(ctx).flatMap(flatId => [...ctx.db.billReview.flat_id.filter(flatId)]),
);

export const my_bill_allocations = spacetimedb.view(
  { name: 'my_bill_allocations', public: true },
  t.array(billAllocation.rowType),
  ctx => callerHomeIds(ctx).flatMap(flatId => [...ctx.db.billAllocation.flat_id.filter(flatId)]),
);

export const my_bill_lines = spacetimedb.view(
  { name: 'my_bill_lines', public: true },
  t.array(billLine.rowType),
  ctx => callerHomeIds(ctx).flatMap(flatId => [...ctx.db.billLine.flat_id.filter(flatId)]),
);

export const my_bill_line_allocations = spacetimedb.view(
  { name: 'my_bill_line_allocations', public: true },
  t.array(billLineAllocation.rowType),
  ctx => callerHomeIds(ctx).flatMap(flatId => [...ctx.db.billLineAllocation.flat_id.filter(flatId)]),
);

export const my_reminders = spacetimedb.view(
  { name: 'my_reminders', public: true },
  t.array(reminder.rowType),
  ctx => callerHomeIds(ctx).flatMap(flatId => [...ctx.db.reminder.flat_id.filter(flatId)]),
);

export const my_reminder_deliveries = spacetimedb.view(
  { name: 'my_reminder_deliveries', public: true },
  t.array(reminderDelivery.rowType),
  ctx => callerHomeIds(ctx).flatMap(flatId => [...ctx.db.reminderDelivery.flat_id.filter(flatId)]),
);

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

function sameIdentity(left: { toHexString(): string }, right: { toHexString(): string }): boolean {
  return left.toHexString() === right.toHexString();
}

function callerMembership(ctx: any): { flatId: bigint; displayName: string } | undefined {
  const active = [...ctx.db.homeMembership.identity.filter(ctx.sender)].find((row: any) => row.active);
  if (active) return { flatId: active.flat_id, displayName: active.display_name };

  // Compatibility bridge for accounts created before multi-home membership was added.
  const legacy = ctx.db.member.identity.find(ctx.sender);
  return legacy ? { flatId: legacy.flat_id, displayName: legacy.display_name } : undefined;
}

function requireCallerHome(ctx: any): { flatId: bigint; displayName: string } {
  const membership = callerMembership(ctx);
  if (!membership) throw new SenderError('Join or create a home before changing household data.');
  return membership;
}

function requireTargetHome(ctx: any, targetFlatId: bigint): void {
  const { flatId } = requireCallerHome(ctx);
  if (flatId !== targetFlatId) throw new SenderError('That item does not belong to your active home.');
}

function membershipFor(ctx: any, identity: any, flatId: bigint): any | undefined {
  return [...ctx.db.homeMembership.identity.filter(identity)].find((row: any) => row.flat_id === flatId);
}

function identityBelongsToHome(ctx: any, identity: any, flatId: bigint): boolean {
  if (membershipFor(ctx, identity, flatId)) return true;
  const legacy = ctx.db.member.identity.find(identity);
  return legacy?.flat_id === flatId;
}

function setActiveHome(ctx: any, flatId: bigint, displayName: string): void {
  for (const row of [...ctx.db.homeMembership.identity.filter(ctx.sender)]) {
    if (row.active !== (row.flat_id === flatId)) {
      ctx.db.homeMembership.id.update({ ...row, active: row.flat_id === flatId });
    }
  }
  const legacy = ctx.db.member.identity.find(ctx.sender);
  const compatibilityRow = { identity: ctx.sender, flat_id: flatId, display_name: displayName };
  if (legacy) ctx.db.member.identity.update(compatibilityRow);
  else ctx.db.member.insert(compatibilityRow);
}

function addOrActivateMembership(ctx: any, flatId: bigint, displayName: string, role: string): void {
  const existing = membershipFor(ctx, ctx.sender, flatId);
  if (existing) {
    ctx.db.homeMembership.id.update({ ...existing, display_name: displayName, active: true });
  } else {
    ctx.db.homeMembership.insert({
      id: 0n,
      identity: ctx.sender,
      flat_id: flatId,
      display_name: displayName,
      role,
      active: true,
      joined_at: ctx.timestamp,
    });
  }
  setActiveHome(ctx, flatId, displayName);
}

function homeMembers(ctx: any, flatId: bigint): any[] {
  const candidates = [
    ...ctx.db.homeMembership.flat_id.filter(flatId),
    ...ctx.db.member.flat_id.filter(flatId),
  ];
  const seen = new Set<string>();
  return candidates.filter((row: any) => {
    const key = row.identity.toHexString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Authentication provider issuer/audience values are deployment-specific. Until they are
// configured, connection identity is used only with explicit home membership authorization.
export const on_connect = spacetimedb.clientConnected(() => {});

export const join_flat = spacetimedb.reducer(
  { flat_id: t.u64(), display_name: t.string() },
  (ctx, { flat_id, display_name }) => {
    const name = display_name.trim();
    if (!name) throw new SenderError('Please choose a display name.');
    const targetFlat = ctx.db.flat.id.find(flat_id);
    if (!targetFlat) throw new SenderError('Selected flat not found.');
    const approvedMembership = membershipFor(ctx, ctx.sender, flat_id);
    if (!approvedMembership) throw new SenderError('Use a valid invitation to join this home.');
    ctx.db.homeMembership.id.update({ ...approvedMembership, display_name: name, active: true });
    for (const row of [...ctx.db.homeMembership.identity.filter(ctx.sender)]) {
      if (row.flat_id !== flat_id && row.active) ctx.db.homeMembership.id.update({ ...row, active: false });
    }
    const current = ctx.db.member.identity.find(ctx.sender);
    const compatibilityRow = { identity: ctx.sender, flat_id, display_name: name };
    if (current) ctx.db.member.identity.update(compatibilityRow);
    else ctx.db.member.insert(compatibilityRow);
  },
);

export const create_and_join_flat = spacetimedb.reducer(
  { residence_id: t.u64(), flat_name: t.string(), flat_number: t.string(), display_name: t.string() },
  (ctx, args) => {
    const flatName = args.flat_name.trim();
    const flatNumber = args.flat_number.trim();
    const name = args.display_name.trim();
    if (!flatName || !flatNumber || !name) throw new SenderError('Flat name, number, and display name are required.');
    const res = ctx.db.residence.id.find(args.residence_id);
    if (!res) throw new SenderError('Residence not found.');
    const newFlat = ctx.db.flat.insert({
      id: 0n,
      residence_id: args.residence_id,
      name: flatName,
      flat_number: flatNumber,
      created_at: ctx.timestamp,
    });
    addOrActivateMembership(ctx, newFlat.id, name, 'owner');
  },
);

export const create_home_and_join = spacetimedb.reducer(
  {
    residence_name: t.string(),
    address: t.string(),
    flat_name: t.string(),
    flat_number: t.string(),
    display_name: t.string(),
  },
  (ctx, args) => {
    const residenceName = args.residence_name.trim();
    const flatName = args.flat_name.trim();
    const flatNumber = args.flat_number.trim();
    const displayName = args.display_name.trim();
    if (!residenceName) throw new SenderError('Residence name is required.');
    if (!flatName || !flatNumber) throw new SenderError('Flat name and number are required.');
    if (!displayName) throw new SenderError('Please choose a display name.');

    const residence = ctx.db.residence.insert({
      id: 0n,
      name: residenceName,
      address: args.address.trim(),
      created_at: ctx.timestamp,
    });
    const flat = ctx.db.flat.insert({
      id: 0n,
      residence_id: residence.id,
      name: flatName,
      flat_number: flatNumber,
      created_at: ctx.timestamp,
    });
    for (const row of [...ctx.db.homeMembership.identity.filter(ctx.sender)]) {
      if (row.active) ctx.db.homeMembership.id.update({ ...row, active: false });
    }
    ctx.db.homeMembership.insert({
      id: 0n,
      identity: ctx.sender,
      flat_id: flat.id,
      display_name: displayName,
      role: 'owner',
      active: true,
      joined_at: ctx.timestamp,
    });
    const current = ctx.db.member.identity.find(ctx.sender);
    const compatibilityRow = { identity: ctx.sender, flat_id: flat.id, display_name: displayName };
    if (current) ctx.db.member.identity.update(compatibilityRow);
    else ctx.db.member.insert(compatibilityRow);
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
      address: address.trim(),
      created_at: ctx.timestamp,
    });
  },
);

export const update_residence_flat = spacetimedb.reducer(
  { residence_name: t.string(), address: t.string(), flat_name: t.string(), flat_number: t.string() },
  (ctx, args) => {
    const { flatId } = requireCallerHome(ctx);
    const currentFlat = ctx.db.flat.id.find(flatId);
    if (!currentFlat) throw new SenderError('Active home not found.');
    const currentRes = ctx.db.residence.id.find(currentFlat.residence_id);
    const updatingResidence = Boolean(args.residence_name.trim() || args.address.trim());
    const residenceHasOtherHomes = [...ctx.db.flat.residence_id.filter(currentFlat.residence_id)]
      .some(row => row.id !== currentFlat.id);
    if (updatingResidence && residenceHasOtherHomes) {
      throw new SenderError('Shared residence details cannot be changed from one home.');
    }
    if (currentRes && updatingResidence) {
      ctx.db.residence.id.update({
        ...currentRes,
        name: args.residence_name.trim() || currentRes.name,
        address: args.address.trim() || currentRes.address,
      });
    }
    ctx.db.flat.id.update({
      ...currentFlat,
      name: args.flat_name.trim() || currentFlat.name,
      flat_number: args.flat_number.trim() || currentFlat.flat_number,
    });
  },
);

export const set_display_name = spacetimedb.reducer(
  { display_name: t.string() },
  (ctx, { display_name }) => {
    const name = display_name.trim();
    if (!name) throw new SenderError('Please choose a display name.');
    const { flatId } = requireCallerHome(ctx);
    const membership = membershipFor(ctx, ctx.sender, flatId);
    if (membership) ctx.db.homeMembership.id.update({ ...membership, display_name: name });
    const current = ctx.db.member.identity.find(ctx.sender);
    if (!current) throw new SenderError('Join a flat before updating your display name.');
    ctx.db.member.identity.update({ ...current, display_name: name });
  },
);

export const switch_home = spacetimedb.reducer(
  { flat_id: t.u64() },
  (ctx, { flat_id }) => {
    const membership = membershipFor(ctx, ctx.sender, flat_id);
    if (!membership) throw new SenderError('You are not a member of that home.');
    setActiveHome(ctx, flat_id, membership.display_name);
  },
);

export const create_home_invitation = spacetimedb.reducer(
  { code: t.string(), recipient: t.string(), expires_at: t.timestamp() },
  (ctx, args) => {
    const { flatId } = requireCallerHome(ctx);
    const settings = ctx.db.homeSettings.flat_id.find(flatId);
    if (settings && !settings.invites_enabled) throw new SenderError('Invitations are disabled for this home.');
    const code = args.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new SenderError('Invitation code must be six letters or numbers.');
    if (args.expires_at.microsSinceUnixEpoch <= ctx.timestamp.microsSinceUnixEpoch) {
      throw new SenderError('Invitation expiry must be in the future.');
    }
    if (ctx.db.homeInvitation.code.find(code)) throw new SenderError('Invitation code is already in use.');
    ctx.db.homeInvitation.insert({
      code,
      flat_id: flatId,
      invited_by: ctx.sender,
      recipient: args.recipient.trim(),
      status: 'pending',
      expires_at: args.expires_at,
      created_at: ctx.timestamp,
    });
  },
);

export const lookup_home_invitation = spacetimedb.procedure(
  { code: t.string() },
  t.option(invitationPreviewRow),
  (ctx, { code }) => ctx.withTx(tx => {
    const normalized = code.trim().toUpperCase();
    const invitation = tx.db.homeInvitation.code.find(normalized);
    if (!invitation || invitation.status !== 'pending') return undefined;
    if (invitation.expires_at.microsSinceUnixEpoch <= tx.timestamp.microsSinceUnixEpoch) return undefined;
    const flat = tx.db.flat.id.find(invitation.flat_id);
    if (!flat) return undefined;
    const residence = tx.db.residence.id.find(flat.residence_id);
    if (!residence) return undefined;
    const inviterMembership = membershipFor(tx, invitation.invited_by, invitation.flat_id);
    const legacyInviter = tx.db.member.identity.find(invitation.invited_by);
    return {
      code: normalized,
      flat_id: flat.id,
      flat_name: flat.name,
      flat_number: flat.flat_number,
      residence_name: residence.name,
      invited_by_name: inviterMembership?.display_name || legacyInviter?.display_name || 'A housemate',
      member_count: homeMembers(tx, flat.id).length,
    };
  }),
);

export const revoke_home_invitation = spacetimedb.reducer(
  { code: t.string() },
  (ctx, { code }) => {
    const invitation = ctx.db.homeInvitation.code.find(code.trim().toUpperCase());
    if (!invitation) throw new SenderError('Invitation not found.');
    requireTargetHome(ctx, invitation.flat_id);
    ctx.db.homeInvitation.code.update({ ...invitation, status: 'revoked' });
  },
);

export const join_home_with_invite = spacetimedb.reducer(
  { code: t.string(), display_name: t.string() },
  (ctx, args) => {
    const invitation = ctx.db.homeInvitation.code.find(args.code.trim().toUpperCase());
    if (!invitation || invitation.status !== 'pending') throw new SenderError('Invitation is invalid or no longer active.');
    if (invitation.expires_at.microsSinceUnixEpoch <= ctx.timestamp.microsSinceUnixEpoch) {
      throw new SenderError('Invitation has expired.');
    }
    const name = args.display_name.trim();
    if (!name) throw new SenderError('Please choose a display name.');
    if (!ctx.db.flat.id.find(invitation.flat_id)) throw new SenderError('Invited home no longer exists.');
    addOrActivateMembership(ctx, invitation.flat_id, name, 'member');
    ctx.db.homeInvitation.code.update({ ...invitation, status: 'accepted' });
  },
);

export const upsert_home_settings = spacetimedb.reducer(
  {
    quiet_hours_start: t.string(),
    quiet_hours_end: t.string(),
    default_billing_split: t.string(),
    invites_enabled: t.bool(),
  },
  (ctx, args) => {
    const { flatId } = requireCallerHome(ctx);
    const split = args.default_billing_split.trim().toLowerCase();
    if (!['equal', 'custom', 'percentage'].includes(split)) throw new SenderError('Unsupported default billing split.');
    const row = {
      flat_id: flatId,
      quiet_hours_start: args.quiet_hours_start.trim(),
      quiet_hours_end: args.quiet_hours_end.trim(),
      default_billing_split: split,
      invites_enabled: args.invites_enabled,
      updated_by: ctx.sender,
      updated_at: ctx.timestamp,
    };
    if (ctx.db.homeSettings.flat_id.find(flatId)) ctx.db.homeSettings.flat_id.update(row);
    else ctx.db.homeSettings.insert(row);
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
    const { flatId } = requireCallerHome(ctx);
    const title = args.title.trim();
    const description = args.description.trim();
    const ruleType = ['implicit', 'explicit'].includes(args.rule_type) ? args.rule_type : 'explicit';
    if (!title) throw new SenderError('Rule title is required.');

    if (args.id > 0n) {
      const existing = ctx.db.flatRule.id.find(args.id);
      if (existing) {
        requireTargetHome(ctx, existing.flat_id);
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
    const existing = ctx.db.flatRule.id.find(id);
    if (!existing) throw new SenderError('Rule not found.');
    requireTargetHome(ctx, existing.flat_id);
    ctx.db.flatRule.id.delete(id);
  },
);

export const create_conversation = spacetimedb.reducer(
  { conversation_id: t.string(), title: t.string() },
  (ctx, { conversation_id, title }) => {
    const id = conversation_id.trim();
    if (!id || id.length > 80) throw new SenderError('Invalid conversation ID.');
    if (ctx.db.conversation.id.find(id)) throw new SenderError('Conversation already exists.');
    const { flatId } = requireCallerHome(ctx);
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
    const { flatId } = requireCallerHome(ctx);
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
    } else {
      requireTargetHome(ctx, conversationRow.flat_id);
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
    const { flatId, displayName } = requireCallerHome(ctx);
    const subject = ctx.db.member.identity.find(ctx.sender);
    const subjectName = subject?.display_name || displayName;
    const existing = [...ctx.db.sharedMemory.subject_identity.filter(ctx.sender)]
      .find(row => row.flat_id === flatId && row.category === args.category && row.memory_key === key);

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
    const { flatId } = requireCallerHome(ctx);
    const existing = [...ctx.db.pantryItem.name.filter(cleanName)].find(row => row.flat_id === flatId);
    if (existing) {
      ctx.db.pantryItem.id.update({
        ...existing,
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

export const upsert_pantry_item = spacetimedb.reducer(
  {
    id: t.u64(),
    name: t.string(),
    quantity: t.i32(),
    unit: t.string(),
    category: t.string(),
    location: t.string(),
    low_stock_threshold: t.i32(),
    use_soon: t.bool(),
  },
  (ctx, args) => {
    const { flatId } = requireCallerHome(ctx);
    const name = args.name.trim().toLowerCase();
    if (!name || args.quantity < 0 || args.low_stock_threshold < 0) throw new SenderError('Pantry values are invalid.');
    let item = args.id > 0n ? ctx.db.pantryItem.id.find(args.id) : undefined;
    if (item) {
      requireTargetHome(ctx, item.flat_id);
      item = ctx.db.pantryItem.id.update({
        ...item,
        name,
        quantity: args.quantity,
        unit: args.unit.trim() || item.unit,
        updated_by: ctx.sender,
      });
    } else {
      item = ctx.db.pantryItem.insert({
        id: 0n,
        flat_id: flatId,
        name,
        quantity: args.quantity,
        unit: args.unit.trim() || 'items',
        updated_by: ctx.sender,
      });
    }
    const detail = {
      pantry_item_id: item.id,
      flat_id: flatId,
      category: args.category.trim().toLowerCase() || 'other',
      location: args.location.trim(),
      low_stock_threshold: args.low_stock_threshold,
      use_soon: args.use_soon,
      updated_at: ctx.timestamp,
    };
    if (ctx.db.pantryItemDetail.pantry_item_id.find(item.id)) ctx.db.pantryItemDetail.pantry_item_id.update(detail);
    else ctx.db.pantryItemDetail.insert(detail);
  },
);

export const delete_pantry_item = spacetimedb.reducer(
  { id: t.u64() },
  (ctx, { id }) => {
    const item = ctx.db.pantryItem.id.find(id);
    if (!item) throw new SenderError('Pantry item not found.');
    requireTargetHome(ctx, item.flat_id);
    if (ctx.db.pantryItemDetail.pantry_item_id.find(id)) ctx.db.pantryItemDetail.pantry_item_id.delete(id);
    ctx.db.pantryItem.id.delete(id);
  },
);

export const record_expense = spacetimedb.reducer(
  { title: t.string(), amount_paise: t.i64() },
  (ctx, { title, amount_paise }) => {
    const cleanTitle = title.trim();
    if (!cleanTitle || amount_paise <= 0n) throw new SenderError('Add an expense name and an amount.');
    const { flatId } = requireCallerHome(ctx);
    const members = homeMembers(ctx, flatId);
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

export const create_bill_review = spacetimedb.reducer(
  {
    title: t.string(),
    amount_paise: t.i64(),
    paid_by: t.identity(),
    expense_date: t.timestamp(),
    category: t.string(),
  },
  (ctx, args) => {
    const { flatId } = requireCallerHome(ctx);
    const title = args.title.trim();
    if (!title || args.amount_paise <= 0n) throw new SenderError('Bill title and amount are required.');
    if (!identityBelongsToHome(ctx, args.paid_by, flatId)) throw new SenderError('Payer is not a member of this home.');
    ctx.db.billReview.insert({
      id: 0n,
      flat_id: flatId,
      title,
      amount_paise: args.amount_paise,
      paid_by: args.paid_by,
      expense_date: args.expense_date,
      category: args.category.trim().toLowerCase() || 'general',
      status: 'draft',
      created_by: ctx.sender,
      created_at: ctx.timestamp,
      updated_at: ctx.timestamp,
    });
  },
);

export const upsert_bill_line = spacetimedb.reducer(
  {
    id: t.u64(),
    bill_review_id: t.u64(),
    line_key: t.string(),
    label: t.string(),
    amount_paise: t.i64(),
    position: t.u32(),
  },
  (ctx, args) => {
    const review = ctx.db.billReview.id.find(args.bill_review_id);
    if (!review) throw new SenderError('Bill review not found.');
    requireTargetHome(ctx, review.flat_id);
    if (review.status !== 'draft') throw new SenderError('Recorded bills cannot be edited.');
    const lineKey = args.line_key.trim();
    const label = args.label.trim();
    if (!lineKey || lineKey.length > 120 || !label || args.amount_paise <= 0n) {
      throw new SenderError('Bill line key, label, and positive amount are required.');
    }
    const existing = args.id > 0n
      ? ctx.db.billLine.id.find(args.id)
      : [...ctx.db.billLine.line_key.filter(lineKey)].find(row => row.bill_review_id === review.id);
    const row = {
      id: existing?.id ?? 0n,
      bill_review_id: review.id,
      flat_id: review.flat_id,
      line_key: lineKey,
      label,
      amount_paise: args.amount_paise,
      position: args.position,
    };
    if (existing) {
      requireTargetHome(ctx, existing.flat_id);
      if (existing.bill_review_id !== review.id) throw new SenderError('Bill line belongs to another review.');
      ctx.db.billLine.id.update(row);
    } else {
      ctx.db.billLine.insert(row);
    }
    ctx.db.billReview.id.update({ ...review, updated_at: ctx.timestamp });
  },
);

export const delete_bill_line = spacetimedb.reducer(
  { id: t.u64() },
  (ctx, { id }) => {
    const line = ctx.db.billLine.id.find(id);
    if (!line) throw new SenderError('Bill line not found.');
    requireTargetHome(ctx, line.flat_id);
    const review = ctx.db.billReview.id.find(line.bill_review_id);
    if (!review || review.status !== 'draft') throw new SenderError('Recorded bill lines cannot be deleted.');
    for (const allocation of [...ctx.db.billLineAllocation.bill_line_id.filter(id)]) {
      ctx.db.billLineAllocation.id.delete(allocation.id);
    }
    ctx.db.billLine.id.delete(id);
    ctx.db.billReview.id.update({ ...review, updated_at: ctx.timestamp });
  },
);

export const upsert_bill_line_allocation = spacetimedb.reducer(
  {
    id: t.u64(),
    bill_review_id: t.u64(),
    bill_line_id: t.u64(),
    member_identity: t.identity(),
    amount_paise: t.i64(),
    exempt: t.bool(),
    reason: t.string(),
  },
  (ctx, args) => {
    const review = ctx.db.billReview.id.find(args.bill_review_id);
    const line = ctx.db.billLine.id.find(args.bill_line_id);
    if (!review || !line || line.bill_review_id !== review.id) throw new SenderError('Bill line allocation target is invalid.');
    requireTargetHome(ctx, review.flat_id);
    if (line.flat_id !== review.flat_id) throw new SenderError('Bill line belongs to another home.');
    if (review.status !== 'draft') throw new SenderError('Recorded bills cannot be edited.');
    if (!identityBelongsToHome(ctx, args.member_identity, review.flat_id)) {
      throw new SenderError('Allocation member is not in this home.');
    }
    if (args.amount_paise < 0n) throw new SenderError('Allocation amount cannot be negative.');
    const existing = args.id > 0n
      ? ctx.db.billLineAllocation.id.find(args.id)
      : [...ctx.db.billLineAllocation.bill_line_id.filter(line.id)]
          .find(row => sameIdentity(row.member_identity, args.member_identity));
    const row = {
      id: existing?.id ?? 0n,
      bill_review_id: review.id,
      bill_line_id: line.id,
      flat_id: review.flat_id,
      member_identity: args.member_identity,
      amount_paise: args.exempt ? 0n : args.amount_paise,
      exempt: args.exempt,
      reason: args.reason.trim(),
    };
    if (existing) {
      requireTargetHome(ctx, existing.flat_id);
      if (existing.bill_review_id !== review.id || existing.bill_line_id !== line.id) {
        throw new SenderError('Allocation belongs to another bill line.');
      }
      ctx.db.billLineAllocation.id.update(row);
    } else {
      ctx.db.billLineAllocation.insert(row);
    }
    ctx.db.billReview.id.update({ ...review, updated_at: ctx.timestamp });
  },
);

export const delete_bill_line_allocation = spacetimedb.reducer(
  { id: t.u64() },
  (ctx, { id }) => {
    const allocation = ctx.db.billLineAllocation.id.find(id);
    if (!allocation) throw new SenderError('Bill line allocation not found.');
    requireTargetHome(ctx, allocation.flat_id);
    const review = ctx.db.billReview.id.find(allocation.bill_review_id);
    if (!review || review.status !== 'draft') throw new SenderError('Recorded allocations cannot be deleted.');
    ctx.db.billLineAllocation.id.delete(id);
    ctx.db.billReview.id.update({ ...review, updated_at: ctx.timestamp });
  },
);

export const upsert_bill_allocation = spacetimedb.reducer(
  {
    id: t.u64(),
    bill_review_id: t.u64(),
    member_identity: t.identity(),
    amount_paise: t.i64(),
    exempt: t.bool(),
    reason: t.string(),
  },
  (ctx, args) => {
    const review = ctx.db.billReview.id.find(args.bill_review_id);
    if (!review) throw new SenderError('Bill review not found.');
    requireTargetHome(ctx, review.flat_id);
    if (review.status !== 'draft') throw new SenderError('Recorded bills cannot be edited.');
    if (!identityBelongsToHome(ctx, args.member_identity, review.flat_id)) {
      throw new SenderError('Allocation member is not in this home.');
    }
    if (args.amount_paise < 0n) throw new SenderError('Allocation amount cannot be negative.');
    const existing = args.id > 0n
      ? ctx.db.billAllocation.id.find(args.id)
      : [...ctx.db.billAllocation.bill_review_id.filter(review.id)]
          .find(row => sameIdentity(row.member_identity, args.member_identity));
    if (existing) {
      requireTargetHome(ctx, existing.flat_id);
      if (existing.bill_review_id !== review.id) throw new SenderError('Allocation belongs to another bill.');
      ctx.db.billAllocation.id.update({
        ...existing,
        member_identity: args.member_identity,
        amount_paise: args.exempt ? 0n : args.amount_paise,
        exempt: args.exempt,
        reason: args.reason.trim(),
      });
    } else {
      ctx.db.billAllocation.insert({
        id: 0n,
        bill_review_id: review.id,
        flat_id: review.flat_id,
        member_identity: args.member_identity,
        amount_paise: args.exempt ? 0n : args.amount_paise,
        exempt: args.exempt,
        reason: args.reason.trim(),
      });
    }
    ctx.db.billReview.id.update({ ...review, updated_at: ctx.timestamp });
  },
);

export const record_reviewed_bill = spacetimedb.reducer(
  { bill_review_id: t.u64() },
  (ctx, { bill_review_id }) => {
    const review = ctx.db.billReview.id.find(bill_review_id);
    if (!review) throw new SenderError('Bill review not found.');
    requireTargetHome(ctx, review.flat_id);
    if (review.status !== 'draft') throw new SenderError('Bill has already been recorded.');
    const lines = [...ctx.db.billLine.bill_review_id.filter(review.id)]
      .sort((left, right) => left.position - right.position);
    let breakdownJson = '';
    let splits: Array<{ memberIdentity: any; amountPaise: bigint; reasons: string[] }> = [];

    if (lines.length > 0) {
      const lineTotal = lines.reduce((total, line) => total + line.amount_paise, 0n);
      if (lineTotal !== review.amount_paise) throw new SenderError('Bill lines must equal the bill total.');
      const splitByMember = new Map<string, { memberIdentity: any; amountPaise: bigint; reasons: string[] }>();
      const serializedLines = lines.map(line => {
        const allocations = [...ctx.db.billLineAllocation.bill_line_id.filter(line.id)];
        if (allocations.length === 0) throw new SenderError(`Allocate bill line: ${line.label}.`);
        const allocated = allocations.reduce((total, row) => total + (row.exempt ? 0n : row.amount_paise), 0n);
        if (allocated !== line.amount_paise) throw new SenderError(`Allocations for ${line.label} must equal its line total.`);
        for (const allocation of allocations) {
          const identityHex = allocation.member_identity.toHexString();
          const aggregate = splitByMember.get(identityHex) ?? {
            memberIdentity: allocation.member_identity,
            amountPaise: 0n,
            reasons: [],
          };
          aggregate.amountPaise += allocation.exempt ? 0n : allocation.amount_paise;
          aggregate.reasons.push(
            allocation.exempt
              ? `${line.label}: exempt${allocation.reason ? ` (${allocation.reason})` : ''}`
              : `${line.label}: ${allocation.amount_paise}${allocation.reason ? ` (${allocation.reason})` : ''}`,
          );
          splitByMember.set(identityHex, aggregate);
        }
        return {
          id: line.id.toString(),
          lineKey: line.line_key,
          label: line.label,
          amountPaise: line.amount_paise.toString(),
          position: line.position,
          allocations: allocations.map(allocation => ({
            id: allocation.id.toString(),
            memberIdentity: allocation.member_identity.toHexString(),
            amountPaise: allocation.amount_paise.toString(),
            exempt: allocation.exempt,
            reason: allocation.reason,
          })),
        };
      });
      breakdownJson = JSON.stringify({ version: 1, lines: serializedLines });
      splits = [...splitByMember.values()];
    } else {
      // Compatibility for drafts created by clients predating structured line persistence.
      const allocations = [...ctx.db.billAllocation.bill_review_id.filter(review.id)];
      if (allocations.length === 0) throw new SenderError('Review at least one allocation before recording.');
      const allocated = allocations.reduce((total, row) => total + (row.exempt ? 0n : row.amount_paise), 0n);
      if (allocated !== review.amount_paise) throw new SenderError('Allocations must equal the bill total.');
      splits = allocations.map(allocation => ({
        memberIdentity: allocation.member_identity,
        amountPaise: allocation.amount_paise,
        reasons: [allocation.exempt ? `Exempt: ${allocation.reason}` : allocation.reason],
      }));
    }
    const inserted = ctx.db.expense.insert({
      id: 0n,
      flat_id: review.flat_id,
      title: review.title,
      amount_paise: review.amount_paise,
      paid_by: review.paid_by,
      category: review.category,
      breakdown_json: breakdownJson,
    });
    for (const split of splits) {
      ctx.db.expenseSplit.insert({
        id: 0n,
        expense_id: inserted.id,
        member_identity: split.memberIdentity,
        amount_paise: split.amountPaise,
        settled: sameIdentity(split.memberIdentity, review.paid_by),
        reason: split.reasons.join('; '),
      });
    }
    ctx.db.billReview.id.update({ ...review, status: 'recorded', updated_at: ctx.timestamp });
  },
);

export const create_reminder = spacetimedb.reducer(
  { title: t.string(), due_at: t.timestamp() },
  (ctx, args) => {
    const { flatId } = requireCallerHome(ctx);
    const title = args.title.trim();
    if (!title) throw new SenderError('Reminder title is required.');
    if (args.due_at.microsSinceUnixEpoch <= ctx.timestamp.microsSinceUnixEpoch) {
      throw new SenderError('Reminder time must be in the future.');
    }
    const row = ctx.db.reminder.insert({
      id: 0n,
      flat_id: flatId,
      title,
      due_at: args.due_at,
      completed: false,
      created_by: ctx.sender,
      created_at: ctx.timestamp,
    });
    ctx.db.reminderJob.insert({
      id: 0n,
      scheduled_at: ScheduleAt.time(args.due_at.microsSinceUnixEpoch),
      reminder_id: row.id,
    });
  },
);

export const complete_reminder = spacetimedb.reducer(
  { id: t.u64() },
  (ctx, { id }) => {
    const row = ctx.db.reminder.id.find(id);
    if (!row) throw new SenderError('Reminder not found.');
    requireTargetHome(ctx, row.flat_id);
    ctx.db.reminder.id.update({ ...row, completed: true });
    for (const job of [...ctx.db.reminderJob.reminder_id.filter(id)]) ctx.db.reminderJob.id.delete(job.id);
  },
);

export const process_reminder = spacetimedb.reducer(
  { onSchedule: reminderJob },
  { reminder_job: reminderJob.rowType },
  (ctx, { reminder_job }) => {
    const row = ctx.db.reminder.id.find(reminder_job.reminder_id);
    if (!row || row.completed) return;
    ctx.db.reminderDelivery.insert({
      id: 0n,
      reminder_id: row.id,
      flat_id: row.flat_id,
      title: row.title,
      delivered_at: ctx.timestamp,
    });
  },
);

function deleteCallerAccountData(ctx: any): void {
  for (const row of [...ctx.db.conversationMessage.owner.filter(ctx.sender)]) {
    ctx.db.conversationMessage.id.delete(row.id);
  }
  for (const row of [...ctx.db.conversation.owner.filter(ctx.sender)]) ctx.db.conversation.id.delete(row.id);
  for (const row of [...ctx.db.sharedMemory.subject_identity.filter(ctx.sender)]) ctx.db.sharedMemory.id.delete(row.id);
  for (const row of [...ctx.db.expenseSplit.member_identity.filter(ctx.sender)]) ctx.db.expenseSplit.id.delete(row.id);
  for (const row of [...ctx.db.homeInvitation.invited_by.filter(ctx.sender)]) ctx.db.homeInvitation.code.delete(row.code);
  for (const row of [...ctx.db.homeMembership.identity.filter(ctx.sender)]) ctx.db.homeMembership.id.delete(row.id);
  if (ctx.db.member.identity.find(ctx.sender)) ctx.db.member.identity.delete(ctx.sender);
  if (ctx.db.aiVerification.owner.find(ctx.sender)) ctx.db.aiVerification.owner.delete(ctx.sender);
  if (ctx.db.aiConfig.owner.find(ctx.sender)) ctx.db.aiConfig.owner.delete(ctx.sender);
}

export const delete_my_account = spacetimedb.reducer({}, ctx => {
  deleteCallerAccountData(ctx);
});

export const clear_all_data = spacetimedb.reducer(
  {},
  ctx => {
    // Compatibility alias for older clients. It is intentionally account-scoped.
    deleteCallerAccountData(ctx);
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
      max_completion_tokens: 2000,
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
