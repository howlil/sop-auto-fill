/**
 * useProsedurEditor hook
 * Extracted from DetailSOPProsedurEditor component
 */

import { useState, useCallback } from "react";
import type { ProsedurRow } from "@/types/ui/sop";

export interface UseProsedurEditorReturn {
  // Dialog state
  isDecisionDialogOpen: boolean;
  setIsDecisionDialogOpen: (open: boolean) => void;
  decisionStepIndex: number | null;
  setDecisionStepIndex: (index: number | null) => void;
  decisionYesId: string;
  setDecisionYesId: (id: string) => void;
  decisionNoId: string;
  setDecisionNoId: (id: string) => void;

  // Row operations
  handleAddRow: (
    index: number,
    implementers: { id: string; name: string }[],
  ) => void;
  handleDeleteRow: (index: number) => void;
  handleTypeChange: (
    index: number,
    type: ProsedurRow["type"],
    terminatorRole?: "start" | "end",
  ) => void;
  handleKegiatanChange: (index: number, kegiatan: string) => void;
  handlePelaksanaChange: (
    index: number,
    implementerId: string,
    implementers: { id: string; name: string }[],
  ) => void;
  handleMutuKelengkapanChange: (index: number, value: string) => void;
  handleMutuWaktuChange: (index: number, amount: string, unit: string) => void;
  handleOutputChange: (index: number, value: string) => void;
  handleKeteranganChange: (index: number, value: string) => void;
  handleDecisionConfig: (index: number, yesId: string, noId: string) => void;
}

export function useProsedurEditor(
  _prosedurRows: ProsedurRow[],
  setProsedurRows: React.Dispatch<React.SetStateAction<ProsedurRow[]>>,
): UseProsedurEditorReturn {
  // Dialog state
  const [isDecisionDialogOpen, setIsDecisionDialogOpen] = useState(false);
  const [decisionStepIndex, setDecisionStepIndex] = useState<number | null>(
    null,
  );
  const [decisionYesId, setDecisionYesId] = useState<string>("");
  const [decisionNoId, setDecisionNoId] = useState<string>("");

  // Row operations
  const handleAddRow = useCallback(
    (index: number, implementers: { id: string; name: string }[]) => {
      setProsedurRows((prev) => {
        const idBase = crypto.randomUUID();
        const newRow: ProsedurRow = {
          id: `${idBase}-${index + 1}`,
          urutan: index + 2,
          no: index + 2,
          kegiatan: "",
          pelaksana: implementers[0]?.id ?? "",
          pelaksanaMapping: implementers.reduce(
            (acc, impl, i) => ({
              ...acc,
              [impl.id]: i === 0 ? "√" : "",
            }),
            {} as Record<string, string>,
          ),
          mutu_kelengkapan: "",
          mutu_waktu: "",
          output: "",
          keterangan: "",
        };
        const next = [...prev];
        next.splice(index + 1, 0, newRow);
        return next.map((r, i) => ({ ...r, no: i + 1 }));
      });
    },
    [setProsedurRows],
  );

  const handleDeleteRow = useCallback(
    (index: number) => {
      setProsedurRows((prev) =>
        prev
          .filter((_, i) => i !== index)
          .map((r, i) => ({
            ...r,
            no: i + 1,
          })),
      );
    },
    [setProsedurRows],
  );

  const handleTypeChange = useCallback(
    (
      index: number,
      type: ProsedurRow["type"],
      terminatorRole?: "start" | "end",
    ) => {
      setProsedurRows((prev) =>
        prev.map((r, i) =>
          i === index
            ? {
                ...r,
                type,
                terminatorRole: type === "terminator" ? terminatorRole : undefined,
              }
            : r,
        ),
      );
    },
    [setProsedurRows],
  );

  const handleKegiatanChange = useCallback(
    (index: number, kegiatan: string) => {
      setProsedurRows((prev) =>
        prev.map((r, i) => (i === index ? { ...r, kegiatan } : r)),
      );
    },
    [setProsedurRows],
  );

  const handlePelaksanaChange = useCallback(
    (
      index: number,
      implementerId: string,
      implementers: { id: string; name: string }[],
    ) => {
      setProsedurRows((prev) =>
        prev.map((r, i) => {
          if (i !== index) return r;
          const nextPelaksana: Record<string, string> = {};
          implementers.forEach((impl) => {
            nextPelaksana[impl.id] = impl.id === implementerId ? "√" : "";
          });
          return {
            ...r,
            pelaksana: implementerId,
            pelaksanaMapping: nextPelaksana,
          };
        }),
      );
    },
    [setProsedurRows],
  );

  const handleMutuKelengkapanChange = useCallback(
    (index: number, value: string) => {
      setProsedurRows((prev) =>
        prev.map((r, i) =>
          i === index ? { ...r, mutu_kelengkapan: value, kelengkapan: value } : r,
        ),
      );
    },
    [setProsedurRows],
  );

  const handleMutuWaktuChange = useCallback(
    (index: number, amount: string, unit: string) => {
      const unitLabelMap: Record<string, string> = {
        m: "Menit",
        h: "Jam",
        d: "Hari",
        w: "Minggu",
        mo: "Bulan",
      };
      const normalizedAmount = amount.trim();
      const parsedAmount = Number.parseInt(normalizedAmount, 10);
      const validAmount =
        normalizedAmount.length > 0 && Number.isFinite(parsedAmount)
          ? Math.max(0, parsedAmount)
          : undefined;
      const normalizedUnit = ["m", "h", "d", "w", "mo"].includes(unit)
        ? unit
        : "m";
      const label = unitLabelMap[normalizedUnit] || "";
      const value = validAmount !== undefined ? `${validAmount} ${label}` : "";
      setProsedurRows((prev) =>
        prev.map((r, i) =>
          i === index
            ? {
                ...r,
                mutu_waktu: value,
                waktu: validAmount,
                time: validAmount,
                satuanWaktu:
                  validAmount !== undefined ? normalizedUnit : undefined,
                time_unit:
                  validAmount !== undefined ? normalizedUnit : undefined,
              }
            : r,
        ),
      );
    },
    [setProsedurRows],
  );

  const handleOutputChange = useCallback(
    (index: number, value: string) => {
      setProsedurRows((prev) =>
        prev.map((r, i) =>
          i === index ? { ...r, output: value, keluaran: value } : r,
        ),
      );
    },
    [setProsedurRows],
  );

  const handleKeteranganChange = useCallback(
    (index: number, value: string) => {
      setProsedurRows((prev) =>
        prev.map((r, i) => (i === index ? { ...r, keterangan: value } : r)),
      );
    },
    [setProsedurRows],
  );

  const handleDecisionConfig = useCallback(
    (index: number, yesId: string, noId: string) => {
      setDecisionStepIndex(index);
      setDecisionYesId(yesId);
      setDecisionNoId(noId === yesId && yesId ? "" : noId);
      setIsDecisionDialogOpen(true);
    },
    [],
  );

  return {
    // Dialog state
    isDecisionDialogOpen,
    setIsDecisionDialogOpen,
    decisionStepIndex,
    setDecisionStepIndex,
    decisionYesId,
    setDecisionYesId,
    decisionNoId,
    setDecisionNoId,

    // Row operations
    handleAddRow,
    handleDeleteRow,
    handleTypeChange,
    handleKegiatanChange,
    handlePelaksanaChange,
    handleMutuKelengkapanChange,
    handleMutuWaktuChange,
    handleOutputChange,
    handleKeteranganChange,
    handleDecisionConfig,
  };
}
