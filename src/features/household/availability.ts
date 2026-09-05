export interface SharedActionAvailability {
  available: boolean;
  reason?: string;
}

export function sharedActionAvailability(
  connected: boolean,
  browserOnline: boolean,
  activeHomeId: bigint | null,
): SharedActionAvailability {
  if (activeHomeId === null) {
    return { available: false, reason: 'Choose a home before using shared household data.' };
  }
  if (!connected || !browserOnline) {
    return { available: false, reason: 'Shared actions are unavailable while offline.' };
  }
  return { available: true };
}
