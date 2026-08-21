import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("workspace production workbench", () => {
  it("uses resource navigation instead of wizard navigation", () => {
    const source = readFileSync("src/pages/workspaces/WorkspaceDetailPage.tsx", "utf8");

    expect(source).toContain('data-workspace-shell="workbench"');
    expect(source).toContain('aria-label="Navigasi workspace"');
    expect(source).toContain("Dokumen SOP");
    expect(source).toContain("Kembali ke Workspaces");
    expect(source).not.toContain('aria-label="Navigasi workspace">Review & Complete');
  });

  it("keeps compact metrics and a searchable status-filtered SOP catalog", () => {
    const source = readFileSync("src/pages/workspaces/WorkspaceDetailPage.tsx", "utf8");

    expect(source).toContain("Total SOP");
    expect(source).toContain("Draft");
    expect(source).toContain("Selesai");
    expect(source).toContain('aria-label="Cari SOP"');
    expect(source).toContain('aria-label="Filter status SOP"');
    expect(source).toContain("Diperbarui");
    expect(source).toContain("Buat SOP");
  });
});
