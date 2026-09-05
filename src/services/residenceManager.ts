// src/services/residenceManager.ts

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

const RESIDENCES_STORAGE_KEY = 'tabby_residences_list';
const FLATS_STORAGE_KEY = 'tabby_flats_list';
const ACTIVE_FLAT_STORAGE_KEY = 'tabby_active_flat';

export const DEFAULT_RESIDENCES: ResidenceItem[] = [
  {
    id: '1',
    name: 'Palm Grove Residency',
    address: '12th Main Road, Indiranagar, Bengaluru',
  },
  {
    id: '2',
    name: 'Greenwood Heights',
    address: 'Outer Ring Road, Bellandur, Bengaluru',
  },
  {
    id: '3',
    name: 'Silver Oak Enclave',
    address: 'Koramangala 4th Block, Bengaluru',
  },
];

export const DEFAULT_FLATS: FlatItem[] = [
  {
    id: '1',
    residenceId: '1',
    name: 'Sunshine Haven',
    flatNumber: 'Flat 402',
    defaultRoommates: ['Sam', 'Alex', 'Maya'],
  },
  {
    id: '2',
    residenceId: '1',
    name: 'Garden Suite',
    flatNumber: 'Flat 104',
    defaultRoommates: ['Rohan', 'Priya'],
  },
  {
    id: '3',
    residenceId: '2',
    name: 'Skyline Loft',
    flatNumber: 'Flat 801',
    defaultRoommates: ['Arjun', 'Neha'],
  },
  {
    id: '4',
    residenceId: '3',
    name: 'Cedar Court',
    flatNumber: 'Flat 205',
    defaultRoommates: ['David', 'Sarah'],
  },
];

export class ResidenceManager {
  static getResidences(): ResidenceItem[] {
    try {
      const data = localStorage.getItem(RESIDENCES_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    this.saveResidences(DEFAULT_RESIDENCES);
    return DEFAULT_RESIDENCES;
  }

  static saveResidences(list: ResidenceItem[]) {
    try {
      localStorage.setItem(RESIDENCES_STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }

  static getFlats(residenceId?: string): FlatItem[] {
    let flats: FlatItem[] = [];
    try {
      const data = localStorage.getItem(FLATS_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) flats = parsed;
      }
    } catch {}
    if (flats.length === 0) {
      flats = DEFAULT_FLATS;
      this.saveFlats(flats);
    }
    if (residenceId) {
      return flats.filter(f => f.residenceId === residenceId);
    }
    return flats;
  }

  static saveFlats(list: FlatItem[]) {
    try {
      localStorage.setItem(FLATS_STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }

  static getActiveFlat(): ActiveFlatSelection {
    try {
      const data = localStorage.getItem(ACTIVE_FLAT_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && parsed.flatId) return parsed;
      }
    } catch {}
    const defaultRes = this.getResidences()[0];
    const defaultFlat = this.getFlats(defaultRes.id)[0] || DEFAULT_FLATS[0];
    const initial: ActiveFlatSelection = {
      residenceId: defaultRes.id,
      residenceName: defaultRes.name,
      flatId: defaultFlat.id,
      flatName: defaultFlat.name,
      flatNumber: defaultFlat.flatNumber,
    };
    this.setActiveFlat(initial);
    return initial;
  }

  static setActiveFlat(selection: ActiveFlatSelection) {
    try {
      localStorage.setItem(ACTIVE_FLAT_STORAGE_KEY, JSON.stringify(selection));
    } catch {}
  }

  static addResidence(name: string, address: string): ResidenceItem {
    const residences = this.getResidences();
    const newRes: ResidenceItem = {
      id: String(Date.now()),
      name: name.trim() || 'New Residence',
      address: address.trim() || 'Bengaluru',
    };
    residences.push(newRes);
    this.saveResidences(residences);
    return newRes;
  }

  static addFlat(residenceId: string, name: string, flatNumber: string): FlatItem {
    const flats = this.getFlats();
    const newFlat: FlatItem = {
      id: String(Date.now()),
      residenceId,
      name: name.trim() || 'My Flat',
      flatNumber: flatNumber.trim() || 'Flat 101',
      defaultRoommates: ['Sam'],
    };
    flats.push(newFlat);
    this.saveFlats(flats);
    return newFlat;
  }

  static onboardMember(residenceId: string, flatId: string, memberName: string): ActiveFlatSelection {
    const residences = this.getResidences();
    const flats = this.getFlats();
    const res = residences.find(r => r.id === residenceId) || residences[0];
    const flat = flats.find(f => f.id === flatId) || flats[0];

    const selection: ActiveFlatSelection = {
      residenceId: res.id,
      residenceName: res.name,
      flatId: flat.id,
      flatName: flat.name,
      flatNumber: flat.flatNumber,
    };

    // Update flat roommates list if memberName not already in
    if (flat.defaultRoommates && !flat.defaultRoommates.includes(memberName)) {
      flat.defaultRoommates.push(memberName);
      this.saveFlats(flats);
    }

    this.setActiveFlat(selection);
    return selection;
  }

  static syncFromDb(
    dbResidences: Array<{ id: bigint | string; name: string; address: string }>,
    dbFlats: Array<{ id: bigint | string; residenceId: bigint | string; name: string; flatNumber: string }>
  ) {
    if (dbResidences.length > 0) {
      const mappedRes: ResidenceItem[] = dbResidences.map(r => ({
        id: r.id.toString(),
        name: r.name,
        address: r.address,
      }));
      this.saveResidences(mappedRes);
    }
    if (dbFlats.length > 0) {
      const mappedFlats: FlatItem[] = dbFlats.map(f => ({
        id: f.id.toString(),
        residenceId: f.residenceId.toString(),
        name: f.name,
        flatNumber: f.flatNumber,
      }));
      this.saveFlats(mappedFlats);
    }
  }
}
