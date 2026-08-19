import type { SopDraftStep } from '../draft/sop-draft.types';

export type AiDraftGenerationInput = {
  deskripsiProses: string;
  tujuanProses?: string;
  catatanTambahan?: string;
  workspaceActorNames: string[];
};

export type AiDraftProviderStep = Omit<SopDraftStep, 'jenis' | 'satuanWaktu'> & {
  jenis: string;
  satuanWaktu: string;
};

export type AiDraftProviderOutput = {
  suggestedTitle: string;
  peringatan: string[];
  kualifikasiPelaksanaan: string[];
  peralatanPerlengkapan: string[];
  pencatatanPendataan: string[];
  steps: AiDraftProviderStep[];
};

export type CanonicalAiDraftContent = {
  suggestedTitle: string;
  peringatan: string[];
  kualifikasiPelaksanaan: string[];
  peralatanPerlengkapan: string[];
  pencatatanPendataan: string[];
  actors: string[];
  steps: SopDraftStep[];
};

export type AiDraftProposal = CanonicalAiDraftContent & {
  actorsToReuse: Array<{ name: string; pelaksanaId: string }>;
  actorsToCreate: string[];
};
