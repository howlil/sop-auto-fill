import { describe, expect, it } from 'vitest'
import { applyAiRevisionToEditor } from '../ai-sop-revision-apply'
import type { SOPDetailMetadata, ProsedurRow } from '@/types/ui/sop'

const metadata: SOPDetailMetadata = { judul:'SOP Lama', warning:['Peringatan lama','Tetap'] }
const rows: ProsedurRow[] = [{ id:'row-1',urutan:1,kegiatan:'Proses',pelaksana:'Petugas',waktu:5,satuanWaktu:'m',mutu_kelengkapan:'Form lama',kelengkapan:'Form lama',output:'Hasil lama',keluaran:'Hasil lama',keterangan:'Catatan lama',type:'task',id_next_step_if_yes:'row-1',id_next_step_if_no:'row-1' }]

describe('applyAiRevisionToEditor', () => {
  it('applies title and existing warning only when before matches', () => {
    expect(applyAiRevisionToEditor({metadata,prosedurRows:rows},{target:{kind:'HEADER',field:'JUDUL'},before:'SOP Lama',after:'SOP Baru',rationale:'x'})).toMatchObject({ok:true,metadata:{judul:'SOP Baru'}})
    const warning=applyAiRevisionToEditor({metadata,prosedurRows:rows},{target:{kind:'PERINGATAN',itemIndex:0},before:'Peringatan lama',after:'Peringatan baru',rationale:'x'})
    expect(warning.ok && warning.metadata.warning).toEqual(['Peringatan baru','Tetap'])
    expect(applyAiRevisionToEditor({metadata,prosedurRows:rows},{target:{kind:'PERINGATAN',itemIndex:9},before:'x',after:'y',rationale:'x'})).toEqual({ok:false,reason:'TARGET_NOT_FOUND'})
  })

  it('applies step text fields without touching protected structure', () => {
    const base=rows[0]
    const kegiatan=applyAiRevisionToEditor({metadata,prosedurRows:rows},{target:{kind:'STEP',stepOrder:1,field:'KEGIATAN'},before:'Proses',after:'Proses terverifikasi',rationale:'x'})
    expect(kegiatan.ok && kegiatan.prosedurRows[0]).toEqual({...base,kegiatan:'Proses terverifikasi'})
    const ket=applyAiRevisionToEditor({metadata,prosedurRows:rows},{target:{kind:'STEP',stepOrder:1,field:'KETERANGAN'},before:'Catatan lama',after:'Catatan baru',rationale:'x'})
    expect(ket.ok && ket.prosedurRows[0].keterangan).toBe('Catatan baru')
  })

  it('updates both legacy aliases for kelengkapan and keluaran', () => {
    const kel=applyAiRevisionToEditor({metadata,prosedurRows:rows},{target:{kind:'STEP',stepOrder:1,field:'KELENGKAPAN'},before:'Form lama',after:'Form baru',rationale:'x'})
    expect(kel.ok && kel.prosedurRows[0]).toMatchObject({kelengkapan:'Form baru',mutu_kelengkapan:'Form baru'})
    const out=applyAiRevisionToEditor({metadata,prosedurRows:rows},{target:{kind:'STEP',stepOrder:1,field:'KELUARAN'},before:'Hasil lama',after:'Berita acara',rationale:'x'})
    expect(out.ok && out.prosedurRows[0]).toMatchObject({keluaran:'Berita acara',output:'Berita acara'})
  })

  it('rejects stale/missing targets without mutation', () => {
    expect(applyAiRevisionToEditor({metadata,prosedurRows:rows},{target:{kind:'HEADER',field:'JUDUL'},before:'SOP berbeda',after:'SOP baru',rationale:'x'})).toEqual({ok:false,reason:'STALE_TARGET'})
    expect(applyAiRevisionToEditor({metadata,prosedurRows:rows},{target:{kind:'STEP',stepOrder:99,field:'KEGIATAN'},before:'x',after:'y',rationale:'x'})).toEqual({ok:false,reason:'TARGET_NOT_FOUND'})
    expect(metadata.judul).toBe('SOP Lama')
    expect(rows[0].kegiatan).toBe('Proses')
  })
})
