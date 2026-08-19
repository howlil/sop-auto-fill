import type { Prisma, StatusSOP } from '../../../generated/prisma';
import type { JenisLangkahProsedur, SatuanWaktu } from '../../../generated/prisma';

export type SopTemplateDbRow = Prisma.SopTemplateGetPayload<{
  include: { steps: true };
}>;

export type WorkspaceActorRow = {
  pelaksanaId: string;
  nama: string;
};

export type ValidatedTemplateStep = {
  urutan: number;
  kegiatan: string;
  jenis: JenisLangkahProsedur;
  kelengkapan: string;
  keluaran: string;
  waktu: number;
  satuanWaktu: SatuanWaktu;
  keterangan: string;
  actorName: string;
  targetYaUrutan: number | null;
  targetTidakUrutan: number | null;
};

export type ValidatedTemplate = {
  templateId: string;
  key: string;
  name: string;
  description: string;
  version: number;
  peringatan: string[];
  kualifikasiPelaksanaan: string[];
  peralatanPerlengkapan: string[];
  pencatatanPendataan: string[];
  steps: ValidatedTemplateStep[];
  actorNames: string[];
};

export type SopTemplateSummary = {
  templateId: string;
  key: string;
  name: string;
  description: string;
  version: number;
  stepCount: number;
  actorNames: string[];
};

export type SopTemplatePreview = {
  template: SopTemplateSummary;
  actorsToReuse: Array<{ name: string; pelaksanaId: string }>;
  actorsToCreate: string[];
  stepCount: number;
  lampiranDefaults: Partial<{
    peringatan: string[];
    kualifikasiPelaksanaan: string[];
    peralatanPerlengkapan: string[];
    pencatatanPendataan: string[];
  }>;
};

export type SopTemplateCreateIdentity = {
  sopId: string;
  detailSopId: string;
  workspaceId: string;
  status: StatusSOP;
};
