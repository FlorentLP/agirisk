export interface Asset {
  id: number;
  name: string;
  category: string;
  status: string;
  latitude: number;
  longitude: number;
}

export interface AssetCreate {
  name: string;
  category: string;
  status: string;
  latitude: number;
  longitude: number;
}

export interface Cluster {
  lat: number;
  lon: number;
  count: number;
  asset_ids: number[];
  /** Present when count === 1, to display the single asset in the popup */
  asset?: Asset;
}

export interface AssetListParams {
  category?: string;
  lat?: number;
  lon?: number;
  radius?: number;
  polygon?: string;
  cluster?: boolean;
}

export const CATEGORIES: { value: string; label: string }[] = [
  { value: 'bouche_incendie', label: 'Bouche incendie' },
  { value: 'armoire_technique', label: 'Armoire technique' },
  { value: 'panneau', label: 'Panneau' },
  { value: 'regard', label: 'Regard' },
  { value: 'autre', label: 'Autre' },
];

export const STATUSES: { value: string; label: string }[] = [
  { value: 'operationnel', label: 'Opérationnel' },
  { value: 'a_verifier', label: 'À vérifier' },
  { value: 'hors_service', label: 'Hors service' },
];
