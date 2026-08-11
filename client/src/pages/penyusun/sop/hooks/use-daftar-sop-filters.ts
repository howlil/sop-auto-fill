/**
 * useDaftarSOPFilters Hook - SOP list filter state
 */

import { useState, useCallback, useMemo } from "react";

export interface DaftarSOPFilters {
  searchQuery: string;
  statusFilter: string | null;
  filterTanggalDari: string | null;
  filterTanggalSampai: string | null;
}

export function useDaftarSopFilters() {
  const [filters, setFilters] = useState<DaftarSOPFilters>({
    searchQuery: "",
    statusFilter: null,
    filterTanggalDari: null,
    filterTanggalSampai: null,
  });

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const setSearchQuery = useCallback((query: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const setStatusFilter = useCallback((status: string | null) => {
    setFilters((prev) => ({ ...prev, statusFilter: status }));
  }, []);

  const setFilterTanggalDari = useCallback((tanggal: string | null) => {
    setFilters((prev) => ({ ...prev, filterTanggalDari: tanggal }));
  }, []);

  const setFilterTanggalSampai = useCallback((tanggal: string | null) => {
    setFilters((prev) => ({ ...prev, filterTanggalSampai: tanggal }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      searchQuery: "",
      statusFilter: null,
      filterTanggalDari: null,
      filterTanggalSampai: null,
    });
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.statusFilter && filters.statusFilter !== "all") count++;
    if (filters.filterTanggalDari) count++;
    if (filters.filterTanggalSampai) count++;
    return count;
  }, [filters]);

  return {
    filters,
    // Direct access aliases for pages that destructure flat
    searchQuery: filters.searchQuery,
    filterStatus: filters.statusFilter,
    filterTanggalDari: filters.filterTanggalDari,
    filterTanggalSampai: filters.filterTanggalSampai,
    isFilterOpen,
    setIsFilterOpen,
    activeFilterCount,
    // Setters
    setSearchQuery,
    setStatusFilter,
    setFilterTanggalDari,
    setFilterTanggalSampai,
    clearFilters,
  };
}
