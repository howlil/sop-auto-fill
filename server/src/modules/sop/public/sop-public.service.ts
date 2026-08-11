import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import {
  resolvePagination,
  toPaginatedData,
  type PaginatedData,
} from '../../../common/utils/pagination.util';
import { SopCatalogService } from '../catalog/sop-catalog.service';
import type { PublicArsipQueryDto } from './dto/public-arsip-query.dto';
import type { PublicOpdItemDto } from './dto/public-opd-item.dto';
import type { PublicSopDokumenDto } from './dto/public-sop-dokumen.dto';
import type { PublicSopByOpdPageDto } from './dto/public-sop-by-opd-page.dto';
import type { PublicSopItemDto } from './dto/public-sop-item.dto';
import { SopPublicRepository } from './sop-public.repository';
import { SopPdfStorageService } from '../pdf/sop-pdf-storage.service';

@Injectable()
export class SopPublicService {
  constructor(
    private readonly sopPublicRepository: SopPublicRepository,
    private readonly sopCatalogService: SopCatalogService,
    private readonly sopPdfStorageService: SopPdfStorageService,
  ) {}

  async listOpd(query: PublicArsipQueryDto): Promise<PaginatedData<PublicOpdItemDto>> {
    const { page, limit, skip, take } = resolvePagination(query);
    const [total, rows] = await Promise.all([
      this.sopPublicRepository.countOpdWithBerlakuSop(query.search),
      this.sopPublicRepository.findOpdWithBerlakuSop({
        search: query.search,
        skip,
        take,
      }),
    ]);
    const items: PublicOpdItemDto[] = rows.map((row) => ({
      opdId: row.opdId,
      nama: row.nama,
      jumlahSopBerlaku: row.jumlahSopBerlaku,
    }));
    return toPaginatedData(items, total, page, limit);
  }

  async listSopByOpd(opdId: string, query: PublicArsipQueryDto): Promise<PublicSopByOpdPageDto> {
    const opd = await this.sopPublicRepository.findOpdAktifById(opdId);
    if (opd === null) {
      throw new NotFoundException('OPD tidak ditemukan');
    }
    const { page, limit, skip, take } = resolvePagination(query);
    const [total, rows] = await Promise.all([
      this.sopPublicRepository.countBerlakuSopByOpd(opdId, query.search),
      this.sopPublicRepository.findBerlakuSopByOpd({
        opdId,
        search: query.search,
        skip,
        take,
      }),
    ]);
    const items = rows.map((row) => this.mapSopItem(row));
    return {
      ...toPaginatedData(items, total, page, limit),
      opd: { opdId: opd.opdId, nama: opd.nama },
    };
  }

  async listSopGlobal(query: PublicArsipQueryDto): Promise<PaginatedData<PublicSopItemDto>> {
    const { page, limit, skip, take } = resolvePagination(query);
    const [total, rows] = await Promise.all([
      this.sopPublicRepository.countBerlakuSopGlobal(query.search),
      this.sopPublicRepository.findBerlakuSopGlobal({
        search: query.search,
        skip,
        take,
      }),
    ]);
    const items = rows.map((row) => this.mapSopItem(row));
    return toPaginatedData(items, total, page, limit);
  }

  private mapSopItem(row: {
    detailSopId: string;
    sopId: string;
    opdId: string;
    judul: string;
    nomorSOP: string;
    versi: number;
    tanggalEfektif: Date | null;
    opdNama: string;
    pdfPath: string;
  }): PublicSopItemDto {
    return {
      detailSopId: row.detailSopId,
      sopId: row.sopId,
      opdId: row.opdId,
      judul: row.judul,
      nomorSOP: row.nomorSOP,
      versi: row.versi,
      tanggalEfektif: row.tanggalEfektif === null ? null : row.tanggalEfektif.toISOString(),
      opdNama: row.opdNama,
      pdfUrl: `/sop/public/pdf/${encodeURIComponent(row.detailSopId)}`,
    };
  }

  async getDokumen(detailSopId: string): Promise<PublicSopDokumenDto> {
    return this.sopCatalogService.getPublicDokumenBerlaku(detailSopId);
  }

  async getPublishedPdf(detailSopId: string): Promise<{
    buffer: Buffer;
    filename: string;
    sizeBytes: number;
  }> {
    const row = await this.sopPublicRepository.findPublishedPdfByDetailSopId(detailSopId);
    if (row === null) {
      throw new GoneException('SOP sudah dicabut, digantikan, atau belum memiliki PDF resmi');
    }
    try {
      const file = await this.sopPdfStorageService.readPublishedPdf(row.pdfPath);
      return {
        buffer: file.buffer,
        sizeBytes: file.sizeBytes,
        filename: this.sanitizeFilename(`SOP-${row.nomorSOP}-v${row.versi}.pdf`),
      };
    } catch {
      throw new GoneException('File PDF SOP resmi tidak tersedia');
    }
  }

  private sanitizeFilename(value: string): string {
    return value
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 120);
  }
}
