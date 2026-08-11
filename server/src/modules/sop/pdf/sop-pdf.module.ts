import { Module } from '@nestjs/common';
import { SopOfficialPdfService } from './sop-official-pdf.service';
import { SopPdfStorageService } from './sop-pdf-storage.service';

@Module({
  providers: [SopOfficialPdfService, SopPdfStorageService],
  exports: [SopOfficialPdfService, SopPdfStorageService],
})
export class SopPdfModule {}
