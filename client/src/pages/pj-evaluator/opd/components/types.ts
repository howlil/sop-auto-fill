export interface OPDOption {
  id: string;
  name: string;
}

export interface KepalaOPDRow {
  id: string;
  name: string;
  nip?: string;
  email?: string;
  phone?: string;
  opdId?: string;
  jabatan?: string;
  pangkat?: string;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  endedAt?: string;
}

export type PersonWithActive = {
  name: string;
  email: string;
  phone: string;
  nip?: string;
  activeAssignment?: KepalaOPDRow & { opdId: string; opdName: string };
};

export interface KepalaCandidate {
  id: string;
  nama: string;
  email: string;
  nip?: string;
}

export interface PindahDialogPersonState {
  id: string;
  name: string;
  email: string;
  phone: string;
  nip?: string;
}
