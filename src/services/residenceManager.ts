export interface ResidenceItem {
  id: string;
  name: string;
  address: string;
}

export interface FlatItem {
  id: string;
  residenceId: string;
  name: string;
  flatNumber: string;
  defaultRoommates?: string[];
}

export interface ActiveFlatSelection {
  residenceId: string;
  residenceName: string;
  flatId: string;
  flatName: string;
  flatNumber: string;
}

export interface ResidenceScope {
  identity: string;
  homeId?: string;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const EMPTY_SELECTION: ActiveFlatSelection = {
  residenceId: '',
  residenceName: '',
  flatId: '',
  flatName: '',
  flatNumber: '',
};

/** Kept as compatibility exports; production starts with honest empty collections. */
export const DEFAULT_RESIDENCES: ResidenceItem[] = [];
export const DEFAULT_FLATS: FlatItem[] = [];

function scopeKey(scope?: ResidenceScope): string {
  if (!scope?.identity.trim()) return 'unscoped';
  return `${encodeURIComponent(scope.identity.trim().toLowerCase())}:${encodeURIComponent(scope.homeId?.trim() || 'all')}`;
}

function key(kind: string, scope?: ResidenceScope): string {
  return `tabby_residence_v2:${scopeKey(scope)}:${kind}`;
}

function readArray<T>(storage: StorageLike, storageKey: string): T[] {
  try {
    const value = JSON.parse(storage.getItem(storageKey) ?? '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function makeId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function requireText(value: string, label: string): string {
  const clean = value.trim();
  if (!clean) throw new Error(`${label} is required.`);
  return clean;
}

export class ScopedResidenceRepository {
  private readonly scope: ResidenceScope;
  private readonly storage: StorageLike;

  constructor(
    scope: ResidenceScope,
    storage: StorageLike = globalThis.localStorage,
  ) {
    if (!scope.identity.trim()) throw new Error('An identity is required to scope residence data.');
    this.scope = scope;
    this.storage = storage;
  }

  getResidences(): ResidenceItem[] {
    return readArray<ResidenceItem>(this.storage, key('residences', this.scope));
  }

  saveResidences(list: ResidenceItem[]): void {
    this.storage.setItem(key('residences', this.scope), JSON.stringify(list));
  }

  getFlats(residenceId?: string): FlatItem[] {
    const flats = readArray<FlatItem>(this.storage, key('flats', this.scope));
    return residenceId ? flats.filter(flat => flat.residenceId === residenceId) : flats;
  }

  saveFlats(list: FlatItem[]): void {
    this.storage.setItem(key('flats', this.scope), JSON.stringify(list));
  }

  getActiveFlat(): ActiveFlatSelection | null {
    try {
      const parsed = JSON.parse(this.storage.getItem(key('active', this.scope)) ?? 'null') as ActiveFlatSelection | null;
      return parsed?.flatId && parsed.residenceId ? parsed : null;
    } catch {
      return null;
    }
  }

  setActiveFlat(selection: ActiveFlatSelection): void {
    const residence = this.getResidences().find(item => item.id === selection.residenceId);
    const flat = this.getFlats(selection.residenceId).find(item => item.id === selection.flatId);
    if (!residence || !flat) throw new Error('The selected home is not available in this account scope.');
    this.storage.setItem(key('active', this.scope), JSON.stringify(selection));
  }

  addResidence(name: string, address: string): ResidenceItem {
    const residence = { id: makeId('residence'), name: requireText(name, 'Residence name'), address: requireText(address, 'Address') };
    this.saveResidences([...this.getResidences(), residence]);
    return residence;
  }

  addFlat(residenceId: string, name: string, flatNumber: string): FlatItem {
    if (!this.getResidences().some(residence => residence.id === residenceId)) {
      throw new Error('The residence does not exist in this account scope.');
    }
    const flat: FlatItem = {
      id: makeId('flat'),
      residenceId,
      name: requireText(name, 'Home name'),
      flatNumber: requireText(flatNumber, 'Flat number'),
      defaultRoommates: [],
    };
    this.saveFlats([...this.getFlats(), flat]);
    return flat;
  }

  onboardMember(residenceId: string, flatId: string): ActiveFlatSelection {
    const residence = this.getResidences().find(item => item.id === residenceId);
    const flat = this.getFlats(residenceId).find(item => item.id === flatId);
    if (!residence || !flat) throw new Error('The selected home is not available in this account scope.');
    const selection: ActiveFlatSelection = {
      residenceId: residence.id,
      residenceName: residence.name,
      flatId: flat.id,
      flatName: flat.name,
      flatNumber: flat.flatNumber,
    };
    this.setActiveFlat(selection);
    return selection;
  }

  syncFromDb(
    dbResidences: Array<{ id: bigint | string; name: string; address: string }>,
    dbFlats: Array<{ id: bigint | string; residenceId: bigint | string; name: string; flatNumber: string }>,
  ): void {
    this.saveResidences(dbResidences.map(row => ({ id: String(row.id), name: row.name, address: row.address })));
    this.saveFlats(dbFlats.map(row => ({
      id: String(row.id),
      residenceId: String(row.residenceId),
      name: row.name,
      flatNumber: row.flatNumber,
      defaultRoommates: [],
    })));
    const active = this.getActiveFlat();
    if (active && !dbFlats.some(row => String(row.id) === active.flatId)) {
      this.storage.removeItem(key('active', this.scope));
    }
  }
}

/** Compatibility facade for current UI; new domain code should call forScope. */
export class ResidenceManager {
  private static unscoped() {
    return new ScopedResidenceRepository({ identity: 'unscoped' });
  }

  static forScope(scope: ResidenceScope, storage?: StorageLike): ScopedResidenceRepository {
    return new ScopedResidenceRepository(scope, storage);
  }

  static getResidences(): ResidenceItem[] { return this.unscoped().getResidences(); }
  static saveResidences(list: ResidenceItem[]): void { this.unscoped().saveResidences(list); }
  static getFlats(residenceId?: string): FlatItem[] { return this.unscoped().getFlats(residenceId); }
  static saveFlats(list: FlatItem[]): void { this.unscoped().saveFlats(list); }
  static getActiveFlat(): ActiveFlatSelection { return this.unscoped().getActiveFlat() ?? { ...EMPTY_SELECTION }; }
  static setActiveFlat(selection: ActiveFlatSelection): void { this.unscoped().setActiveFlat(selection); }
  static addResidence(name: string, address: string): ResidenceItem { return this.unscoped().addResidence(name, address); }
  static addFlat(residenceId: string, name: string, flatNumber: string): FlatItem { return this.unscoped().addFlat(residenceId, name, flatNumber); }
  static onboardMember(residenceId: string, flatId: string, _memberName: string): ActiveFlatSelection {
    return this.unscoped().onboardMember(residenceId, flatId);
  }
  static syncFromDb(
    residences: Array<{ id: bigint | string; name: string; address: string }>,
    flats: Array<{ id: bigint | string; residenceId: bigint | string; name: string; flatNumber: string }>,
  ): void { this.unscoped().syncFromDb(residences, flats); }
}
