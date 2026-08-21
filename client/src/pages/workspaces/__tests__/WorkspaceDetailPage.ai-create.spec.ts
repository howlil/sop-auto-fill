import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api/api-client";
import { workspaceSopApi } from "@/api/workspace-sops";

vi.mock("@/lib/api/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const proposal = {
  suggestedTitle: "SOP Pelayanan Permohonan",
  peringatan: ["Pastikan data lengkap"],
  kualifikasiPelaksanaan: ["Memahami alur pelayanan"],
  peralatanPerlengkapan: ["Komputer"],
  pencatatanPendataan: ["Register pelayanan"],
  actors: ["Petugas Layanan", "Verifikator"],
  actorsToReuse: [{ name: "Petugas Layanan", pelaksanaId: "actor-1" }],
  actorsToCreate: ["Verifikator"],
  steps: [
    {
      urutan: 1,
      kegiatan: "Menerima permohonan",
      jenis: "AWAL_AKHIR" as const,
      kelengkapan: "Formulir",
      keluaran: "Permohonan diterima",
      waktu: 5,
      satuanWaktu: "m" as const,
      keterangan: "Catat permohonan",
      actorName: "Petugas Layanan",
      targetYaUrutan: null,
      targetTidakUrutan: null,
    },
    {
      urutan: 2,
      kegiatan: "Memverifikasi permohonan",
      jenis: "KEPUTUSAN" as const,
      kelengkapan: "Permohonan diterima",
      keluaran: "Hasil verifikasi",
      waktu: 10,
      satuanWaktu: "m" as const,
      keterangan: "Tentukan kelengkapan",
      actorName: "Verifikator",
      targetYaUrutan: 3,
      targetTidakUrutan: 1,
    },
    {
      urutan: 3,
      kegiatan: "Menyerahkan hasil",
      jenis: "AWAL_AKHIR" as const,
      kelengkapan: "Hasil verifikasi",
      keluaran: "Layanan selesai",
      waktu: 5,
      satuanWaktu: "m" as const,
      keterangan: "Serahkan hasil",
      actorName: "Petugas Layanan",
      targetYaUrutan: null,
      targetTidakUrutan: null,
    },
  ],
};

describe("workspace SOP AI draft client contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("memiliki endpoint availability, generate preview, dan create-from-AI", () => {
    workspaceSopApi.aiDraftAvailability();
    workspaceSopApi.generateAiDraft({
      workspaceId: "workspace-1",
      deskripsiProses: "Proses penerimaan dan verifikasi permohonan layanan.",
      tujuanProses: "Memastikan layanan konsisten",
      catatanTambahan: "Gunakan alur sederhana",
    });
    workspaceSopApi.createFromAiDraft({
      workspaceId: "workspace-1",
      judul: "SOP Pelayanan Permohonan",
      nomorSop: "SOP/AI/001",
      namaLembaga: "Unit Pelayanan",
      proposal,
    });

    expect(apiClient.get).toHaveBeenCalledWith("/sop/ai-drafts/availability");
    expect(apiClient.post).toHaveBeenCalledWith("/sop/ai-drafts/generate", {
      workspaceId: "workspace-1",
      deskripsiProses: "Proses penerimaan dan verifikasi permohonan layanan.",
      tujuanProses: "Memastikan layanan konsisten",
      catatanTambahan: "Gunakan alur sederhana",
    });
    expect(apiClient.post).toHaveBeenCalledWith("/sop/ai-drafts/create", {
      workspaceId: "workspace-1",
      judul: "SOP Pelayanan Permohonan",
      nomorSop: "SOP/AI/001",
      namaLembaga: "Unit Pelayanan",
      proposal,
    });
  });

  it("creation surface menyediakan jalur AI yang eksplisit, generate terpisah, preview, dan confirmation", () => {
    const source = readFileSync("src/pages/workspaces/WorkspaceDetailPage.tsx", "utf8");

    expect(source).toContain('type CreateSource = "blank" | "template" | "ai"');
    expect(source).toContain("Buat SOP");
    expect(source).toContain("Buat dengan AI");
    expect(source).toContain("Direkomendasikan");
    expect(source).toContain("Apa proses yang ingin Anda dokumentasikan?");
    expect(source).toContain("Tambahkan konteks opsional");
    expect(source).toContain("Tujuan proses");
    expect(source).toContain("Catatan tambahan");
    expect(source).toContain("Generate draft");
    expect(source).toContain("Preview AI");
    expect(source).toContain("aiDraftAvailability");
    expect(source).toContain("generateAiDraft");
    expect(source).toContain("createFromAiDraft");
    expect(source).toContain("aiProposal");
    expect(source).toContain("Buat dan lanjutkan");
  });
});
