export interface SubscriptionGroup<TScope extends 'people' | 'household', TTables> {
  scope: TScope;
  tables: TTables;
}

export type HouseholdSubscriptionGroups<TMember, THousehold extends unknown[]> = [
  SubscriptionGroup<'people', [TMember]>,
  SubscriptionGroup<'household', THousehold>,
];

export function createSubscriptionGroups<TMember, THousehold extends unknown[]>(
  memberTable: TMember,
  householdTables: THousehold,
): HouseholdSubscriptionGroups<TMember, THousehold> {
  return [
    { scope: 'people', tables: [memberTable] },
    { scope: 'household', tables: householdTables },
  ];
}
