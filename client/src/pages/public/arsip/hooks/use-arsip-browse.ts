import { useEffect, useMemo, useState } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { usePublicOpdList, usePublicSopGlobalList, usePublicSopList } from '@/api/sop-public'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { ROUTES } from '@/utils/constants'
import type { PublicSopItem } from '@/types/dto/sop-public.dto'
import { arsipHomeCrumb, type ArsipBreadcrumbItem } from '../components/arsip-chrome'
import type { ArsipBrowseWorkspaceProps } from '../components/arsip-browse-workspace'
import {
  ARSIP_AUTO_SELECT_SOP_MAX,
  ARSIP_OPD_PAGE_SIZE,
  ARSIP_SOP_PAGE_SIZE,
  type ArsipBrowseSearch,
} from '../arsip-search-schema'

const arsipRoute = getRouteApi('/arsip/')
const EMPTY_PUBLIC_SOP_ITEMS: PublicSopItem[] = []

export interface ArsipBrowseMobileState {
  showOpd: boolean
  showSopList: boolean
  showPreview: boolean
  isGlobalMode: boolean
  detailSopId?: string
}

export function useArsipBrowse() {
  const search = arsipRoute.useSearch()
  const navigate = arsipRoute.useNavigate()
  const opdId = search.opdId
  const detailSopId = search.detailSopId
  const q = search.q?.trim() ?? ''
  const sopSearchParam = search.sopSearch?.trim() ?? ''
  const opdPage = search.opdPage ?? 1
  const sopPage = search.sopPage ?? 1
  const isGlobalMode = q.length > 0

  const [globalInput, setGlobalInput] = useState(q)
  const [opdFilter, setOpdFilter] = useState('')
  const [sopFilterInput, setSopFilterInput] = useState(sopSearchParam)
  const debouncedGlobal = useDebouncedValue(globalInput, 350)
  const debouncedOpdFilter = useDebouncedValue(opdFilter, 350)
  const debouncedSopSearch = useDebouncedValue(sopFilterInput, 350)

  useEffect(() => {
    setGlobalInput(q)
  }, [q])

  useEffect(() => {
    setSopFilterInput(sopSearchParam)
  }, [sopSearchParam])

  useEffect(() => {
    const next = debouncedGlobal.trim()
    if (next === q) {
      return
    }
    void navigate({
      search: (prev: ArsipBrowseSearch) => ({
        ...prev,
        q: next || undefined,
        opdId: next ? undefined : prev.opdId,
        detailSopId: undefined,
        sopPage: 1,
        sopSearch: undefined,
      }),
    })
  }, [debouncedGlobal, q, navigate])

  useEffect(() => {
    const next = debouncedSopSearch.trim()
    if (next === sopSearchParam || isGlobalMode || !opdId) {
      return
    }
    void navigate({
      search: (prev: ArsipBrowseSearch) => ({
        ...prev,
        sopSearch: next || undefined,
        sopPage: 1,
        detailSopId: undefined,
      }),
    })
  }, [debouncedSopSearch, sopSearchParam, isGlobalMode, opdId, navigate])

  const opdQuery = usePublicOpdList({
    page: opdPage,
    limit: ARSIP_OPD_PAGE_SIZE,
    search: debouncedOpdFilter || undefined,
  })

  const sopByOpdQuery = usePublicSopList(opdId ?? '', {
    page: sopPage,
    limit: ARSIP_SOP_PAGE_SIZE,
    search: debouncedSopSearch || undefined,
  })

  const globalSopQuery = usePublicSopGlobalList({
    page: sopPage,
    limit: ARSIP_SOP_PAGE_SIZE,
    search: q,
  })

  const opdItems = opdQuery.data?.items ?? []
  const opdPagination = opdQuery.data?.pagination
  const selectedOpdName =
    sopByOpdQuery.data?.opd.nama ?? opdItems.find((o) => o.opdId === opdId)?.nama

  const sopItems = useMemo(
    () =>
      isGlobalMode
        ? (globalSopQuery.data?.items ?? EMPTY_PUBLIC_SOP_ITEMS)
        : (sopByOpdQuery.data?.items ?? EMPTY_PUBLIC_SOP_ITEMS),
    [globalSopQuery.data?.items, isGlobalMode, sopByOpdQuery.data?.items],
  )

  const sopPagination = isGlobalMode
    ? globalSopQuery.data?.pagination
    : sopByOpdQuery.data?.pagination

  const sopLoading = isGlobalMode
    ? globalSopQuery.isLoading
    : Boolean(opdId) && sopByOpdQuery.isLoading

  const sopError = isGlobalMode
    ? globalSopQuery.isError
    : Boolean(opdId) && sopByOpdQuery.isError

  const sopFetching = isGlobalMode
    ? globalSopQuery.isFetching
    : Boolean(opdId) && sopByOpdQuery.isFetching

  const sopListReady = isGlobalMode
    ? globalSopQuery.isSuccess
    : Boolean(opdId) && sopByOpdQuery.isSuccess

  const totalSopCount = sopPagination?.totalItems ?? 0
  const hasSopSearchFilter = sopSearchParam.length > 0

  useEffect(() => {
    if (detailSopId || isGlobalMode || !opdId || !sopListReady || sopItems.length === 0) {
      return
    }
    if (totalSopCount > ARSIP_AUTO_SELECT_SOP_MAX) {
      return
    }
    const first = sopItems[0]
    if (!first) {
      return
    }
    void navigate({
      search: (prev: ArsipBrowseSearch) => ({
        ...prev,
        detailSopId: first.detailSopId,
      }),
      replace: true,
    })
  }, [detailSopId, isGlobalMode, opdId, sopListReady, sopItems, totalSopCount, navigate])

  function handleSelectOpd(id: string) {
    setGlobalInput('')
    setSopFilterInput('')
    void navigate({
      search: (prev: ArsipBrowseSearch) => ({
        ...prev,
        opdId: id,
        q: undefined,
        detailSopId: undefined,
        sopPage: 1,
        sopSearch: undefined,
      }),
    })
  }

  function handleChangeOpd() {
    setSopFilterInput('')
    void navigate({
      search: (prev: ArsipBrowseSearch) => {
        const next = { ...prev }
        delete next.opdId
        delete next.detailSopId
        delete next.sopPage
        delete next.sopSearch
        return next
      },
    })
  }

  function handleSelectSop(sop: PublicSopItem) {
    void navigate({
      search: (prev: ArsipBrowseSearch) => ({
        ...prev,
        opdId: sop.opdId,
        detailSopId: sop.detailSopId,
      }),
    })
  }

  function handleClosePreview() {
    void navigate({
      search: (prev: ArsipBrowseSearch) => {
        const next = { ...prev }
        delete next.detailSopId
        return next
      },
    })
  }

  function handleMobileBackToOpd() {
    setGlobalInput('')
    setSopFilterInput('')
    void navigate({
      search: { opdPage },
    })
  }

  function handleOpdPageChange(page: number) {
    void navigate({
      search: (prev: ArsipBrowseSearch) => ({ ...prev, opdPage: page }),
    })
  }

  function handleSopPageChange(page: number) {
    void navigate({
      search: (prev: ArsipBrowseSearch) => ({ ...prev, sopPage: page }),
    })
  }

  function handleSopSearchChange(value: string) {
    setSopFilterInput(value)
  }

  function handleOpdFilterChange(value: string) {
    setOpdFilter(value)
    void navigate({ search: (prev: ArsipBrowseSearch) => ({ ...prev, opdPage: 1 }) })
  }

  const panelTitle = isGlobalMode
    ? 'Hasil pencarian'
    : opdId
      ? (selectedOpdName ?? 'Daftar SOP')
      : 'Daftar SOP'

  const panelSubtitle = isGlobalMode
    ? `Kata kunci: “${q}”`
    : opdId
      ? 'Dokumen berstatus Berlaku'
      : undefined

  const sopEmptyTitle = isGlobalMode
    ? 'Tidak ada SOP ditemukan'
    : hasSopSearchFilter
      ? 'Tidak ada SOP cocok'
      : 'Tidak ada SOP berlaku'

  const sopEmptyHint = isGlobalMode
    ? 'Coba kata kunci lain atau pilih OPD di daftar.'
    : hasSopSearchFilter
      ? 'Coba kata kunci lain pada filter di atas.'
      : 'Belum ada dokumen berlaku pada OPD ini.'

  const selectedSopJudul = useMemo(() => {
    if (!detailSopId) {
      return undefined
    }
    return sopItems.find((s) => s.detailSopId === detailSopId)?.judul
  }, [detailSopId, sopItems])
  const selectedSop = useMemo(() => {
    if (!detailSopId) {
      return undefined
    }
    return sopItems.find((s) => s.detailSopId === detailSopId)
  }, [detailSopId, sopItems])

  const breadcrumbItems = useMemo((): ArsipBreadcrumbItem[] => {
    const items: ArsipBreadcrumbItem[] = [arsipHomeCrumb()]
    if (opdId && selectedOpdName) {
      items.push({
        label: selectedOpdName,
        to: ROUTES.ARSIP.PREFIX,
        search: {
          opdId,
          sopPage: sopPage > 1 ? String(sopPage) : undefined,
          sopSearch: sopSearchParam || undefined,
        },
      })
    }
    if (detailSopId) {
      items.push({ label: selectedSopJudul ?? 'Dokumen SOP' })
    }
    return items
  }, [opdId, selectedOpdName, detailSopId, selectedSopJudul, sopPage, sopSearchParam])

  const workspaceProps: ArsipBrowseWorkspaceProps = {
    isGlobalMode,
    opdId,
    selectedOpdName,
    detailSopId,
    selectedSop,
    opdItems,
    opdFilter,
    onOpdFilterChange: handleOpdFilterChange,
    onSelectOpd: handleSelectOpd,
    onChangeOpd: handleChangeOpd,
    opdLoading: opdQuery.isLoading,
    opdError: opdQuery.isError,
    opdFetching: opdQuery.isFetching,
    opdPagination,
    opdPage,
    onOpdPageChange: handleOpdPageChange,
    sopPanelTitle: panelTitle,
    sopPanelSubtitle: panelSubtitle,
    sopItems,
    sopPagination,
    sopPage,
    onSopPageChange: handleSopPageChange,
    sopLoading,
    sopError,
    sopFetching,
    showOpdColumn: isGlobalMode,
    showSopSearchFilter: Boolean(opdId) && !isGlobalMode,
    sopSearch: sopFilterInput,
    onSopSearchChange: handleSopSearchChange,
    onSelectSop: handleSelectSop,
    onClosePreview: handleClosePreview,
    onRefreshPreview: () => {
      void (isGlobalMode ? globalSopQuery.refetch() : sopByOpdQuery.refetch())
    },
    sopEmptyTitle,
    sopEmptyHint,
  }

  const mobile: ArsipBrowseMobileState = {
    showOpd: !isGlobalMode && !opdId && !detailSopId,
    showSopList: (isGlobalMode || Boolean(opdId)) && !detailSopId,
    showPreview: Boolean(detailSopId),
    isGlobalMode,
    detailSopId,
  }

  return {
    globalInput,
    setGlobalInput,
    breadcrumbItems,
    showBreadcrumb: Boolean(opdId || detailSopId),
    workspaceProps,
    mobile,
    handleSelectOpd,
    handleMobileBackToOpd,
    handleSelectSop,
    handleClosePreview,
    handleOpdPageChange,
    handleSopPageChange,
    handleSopSearchChange,
    opdQuery,
    panelTitle,
    panelSubtitle,
    sopItems,
    selectedSop,
    sopPagination,
    sopPage,
    sopLoading,
    sopError,
    sopFetching,
    sopEmptyTitle,
    sopEmptyHint,
    sopFilterInput,
    opdId,
    isGlobalMode,
  }
}
