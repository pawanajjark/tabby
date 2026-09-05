export interface RoommateListRow {
  identityHex: string;
  flatId: string;
  displayName: string;
}

export function selectFlatRoommates(
  rows: RoommateListRow[],
  activeFlatId: string,
  currentIdentity: string,
): RoommateListRow[] {
  const sorted = rows
    .filter(row => row.flatId === activeFlatId)
    .sort((a, b) => {
      const aIsCurrent = a.identityHex === currentIdentity;
      const bIsCurrent = b.identityHex === currentIdentity;
      if (aIsCurrent !== bIsCurrent) return aIsCurrent ? -1 : 1;

      const byName = a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
      return byName || a.identityHex.localeCompare(b.identityHex);
    });

  const seenNames = new Set<string>();
  return sorted.filter(row => {
    const nameKey = row.displayName.trim().toLocaleLowerCase();
    if (seenNames.has(nameKey)) return false;
    seenNames.add(nameKey);
    return true;
  });
}
