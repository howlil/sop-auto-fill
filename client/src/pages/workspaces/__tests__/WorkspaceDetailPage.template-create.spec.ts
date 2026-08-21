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

describe("workspace SOP template client contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("memiliki endpoint list, preview, dan create-from-template", () => {
    workspaceSopApi.listTemplates();
    workspaceSopApi.previewTemplate("template-1", "workspace-1");
    workspaceSopApi.createFromTemplate("template-1", {
      workspaceId: "workspace-1",
      judul: "SOP Pelayanan",
      nomorSop: "SOP-001",
      namaLembaga: "Unit Pelayanan",
    });

    expect(apiClient.get).toHaveBeenCalledWith("/sop/templates");
    expect(apiClient.get).toHaveBeenCalledWith(
      "/sop/templates/template-1/preview?workspaceId=workspace-1",
    );
    expect(apiClient.post).toHaveBeenCalledWith("/sop/templates/template-1/create", {
      workspaceId: "workspace-1",
      judul: "SOP Pelayanan",
      nomorSop: "SOP-001",
      namaLembaga: "Unit Pelayanan",
    });
  });

  it("creation surface menyediakan jalur Mulai kosong dan Gunakan template", () => {
    const source = readFileSync("src/pages/workspaces/WorkspaceDetailPage.tsx", "utf8");

    expect(source).toContain("Mulai kosong");
    expect(source).toContain("Gunakan template");
    expect(source).toContain("namaLembaga");
    expect(source).toContain("previewTemplate");
    expect(source).toContain("createFromTemplate");
  });
});
