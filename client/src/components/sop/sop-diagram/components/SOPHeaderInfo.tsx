import { Input } from '@/components/ui/input'
import type { TTESignaturePayload } from '@/types/dto/tte.dto'
import { TTESignatureBlock } from '@/components/tte/tte-signature-block'
import { SOP_INSTITUTION_LOGO_URL } from '@/lib/sop/sop-institution-logo'
import {
  formatIsoToDdMmYyyyWib,
  isoToDateInputValueWib,
} from '@/utils/format-date'

export interface SOPHeaderInfoProps {
  name: string
  number?: string
  version?: number
  createdDate?: string
  revisionDate?: string
  effectiveDate?: string
  /** Diabaikan untuk tampilan: logo memakai aset provinsi (lihat `SOP_INSTITUTION_LOGO_URL`). */
  institutionLogo?: string
  /** Baris-baris nama/detail lembaga (maks 4 baris), dari API / `namaLembaga` terpecah baris. */
  institutionLines?: string[]
  picName: string
  picNumber: string
  picRole?: string
  lawBasis?: string[]
  implementQualification?: string[]
  relatedSop?: string[]
  equipment?: string[]
  warning?: string | string[]
  recordData?: string[]
  signature?: string
  /** Tanda tangan elektronik BSRE (jika SOP sudah disahkan dengan TTE). */
  tteSignaturePayload?: TTESignaturePayload | null
  editable?: boolean
  onMetadataChange?: (field: string, value: unknown) => void
}

function toArrayField(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.length > 0) return [value]
  return []
}

export function SOPHeaderInfo({
  name,
  number = '',
  version = 1,
  createdDate = '',
  revisionDate = '',
  effectiveDate = '',
  institutionLogo: _unusedInstitutionLogo = '',
  institutionLines = [],
  picName,
  picNumber,
  picRole = 'Penanggung Jawab',
  lawBasis = [],
  implementQualification = [],
  relatedSop = [],
  equipment = [],
  warning = [],
  recordData = [],
  signature = '',
  tteSignaturePayload,
  editable = false,
  onMetadataChange,
}: SOPHeaderInfoProps) {
  const handleChange = (field: string, value: unknown) => {
    if (editable && onMetadataChange) onMetadataChange(field, value)
  }

  /** Tampilan DD/MM/YYYY (Asia/Jakarta) untuk ISO / YYYY-MM-DD / teks DD/MM/YYYY lama. */
  function headerDisplayDate(raw: string): string {
    const s = raw.trim()
    if (!s) return ''
    if (s.includes('T') || s.endsWith('Z')) return formatIsoToDdMmYyyyWib(s)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatIsoToDdMmYyyyWib(`${s}T12:00:00+07:00`)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s
    return s
  }

  /** Nilai untuk `<input type="date">` (YYYY-MM-DD, hari kalender Jakarta). */
  function headerDateInputValue(raw: string): string {
    const s = raw.trim()
    if (!s) return ''
    if (s.includes('T') || s.endsWith('Z')) return isoToDateInputValueWib(s)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
      const [dd, mm, yyyy] = s.split('/')
      if (dd !== undefined && mm !== undefined && yyyy !== undefined) return `${yyyy}-${mm}-${dd}`
    }
    return ''
  }

  return (
    <div className="flex justify-center">
      <div className="px-4 lg:px-0 print:px-0 overflow-x-auto">
        <div className="print-page print-break-after-page w-full max-w-[calc(297mm-3cm)] min-w-0 box-border pb-2 print:w-[calc(297mm-3cm)] print:min-w-[calc(297mm-3cm)] print:max-w-[calc(297mm-3cm)] print:my-0 print:mx-auto print:pb-0 [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
          <table className="w-full border-collapse border-2 border-black text-sm bg-surface table-fixed">
            <colgroup>
              <col style={{ width: '45%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '2%' }} />
              <col style={{ width: '27%' }} />
            </colgroup>
            <tbody>
              {/* Baris 1: Kolom kiri (rowspan 7) = logo + instansi */}
              <tr>
                <th
                  rowSpan={7}
                  className="border-2 py-0.5 px-2 border-black align-top bg-surface min-w-0 break-words"
                >
                  <img
                    className="mx-auto h-36 my-4"
                    src={SOP_INSTITUTION_LOGO_URL}
                    alt="Logo Provinsi Sumatera Barat"
                  />
                  {institutionLines.length > 0 ? (
                    <div className="break-words min-w-0">
                      {institutionLines.slice(0, 4).map((line, idx) => (
                        <p
                          key={idx}
                          className="m-0 font-semibold text-sm leading-tight break-words"
                        >
                          {line}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <div className="break-words min-w-0">
                      <p className="m-0 font-semibold text-sm leading-tight break-words text-secondary-foreground">
                        —
                      </p>
                    </div>
                  )}
                </th>
              </tr>
              <tr>
                <td className="font-semibold border-2 py-0.5 px-2 border-black whitespace-nowrap overflow-hidden">
                  NOMOR SOP
                </td>
                <td className="border-2 border-r-0 py-0.5 px-2 border-black text-center">:</td>
                <td className="border-2 border-l-0 py-0.5 px-2 border-black min-w-0 break-words">
                  {editable ? (
                    <Input
                      className="h-6 text-xs border-0 p-0 min-h-0 w-full bg-transparent break-words"
                      value={number}
                      onChange={(e) => handleChange('number', e.target.value)}
                    />
                  ) : (
                    <span className="break-words">{number || ' - '}</span>
                  )}
                </td>
              </tr>
              <tr>
                <td className="font-semibold border-2 py-0.5 px-2 border-black whitespace-nowrap overflow-hidden">
                  TANGGAL PEMBUATAN
                </td>
                <td className="border-2 border-r-0 py-0.5 px-2 border-black text-center">:</td>
                <td className="border-2 border-l-0 py-0.5 px-2 border-black min-w-0 break-words">
                  {editable ? (
                    <Input
                      type="date"
                      className="h-6 text-xs border-0 p-0 min-h-0 w-full bg-transparent"
                      value={headerDateInputValue(createdDate)}
                      onChange={(e) => handleChange('createdDate', e.target.value)}
                    />
                  ) : (
                    headerDisplayDate(createdDate)
                  )}
                </td>
              </tr>
              <tr>
                <td className="font-semibold border-2 py-0.5 px-2 border-black whitespace-nowrap overflow-hidden">
                  TANGGAL REVISI
                </td>
                <td className="border-2 border-r-0 py-0.5 px-2 border-black text-center">:</td>
                <td className="border-2 border-l-0 py-0.5 px-2 border-black min-w-0 break-words">
                  {editable ? (
                    <Input
                      type="date"
                      className="h-6 text-xs border-0 p-0 min-h-0 w-full bg-transparent"
                      value={headerDateInputValue(revisionDate)}
                      onChange={(e) => handleChange('revisionDate', e.target.value)}
                    />
                  ) : (
                    revisionDate && version > 1 ? headerDisplayDate(revisionDate) : ''
                  )}
                </td>
              </tr>
              <tr>
                <td className="font-semibold border-2 py-0.5 px-2 border-black whitespace-nowrap overflow-hidden">
                  TANGGAL EFEKTIF
                </td>
                <td className="border-2 border-r-0 py-0.5 px-2 border-black text-center">:</td>
                <td className="border-2 border-l-0 py-0.5 px-2 border-black min-w-0 break-words">
                  {effectiveDate.trim() !== '' ? headerDisplayDate(effectiveDate) : '—'}
                </td>
              </tr>
              <tr>
                <td className="font-semibold align-top border-2 py-0.5 px-2 border-black whitespace-nowrap overflow-hidden">
                  DISAHKAN OLEH
                </td>
                <td className="align-top border-2 border-r-0 py-0.5 px-2 border-black text-center">:</td>
                <td className="text-center font-semibold border-2 border-l-0 py-0.5 px-2 border-black min-w-0 break-words">
                  <div className="min-h-[6rem]">
                    {tteSignaturePayload ? (
                      <TTESignatureBlock
                        payload={tteSignaturePayload}
                        qrSize={72}
                        showRoleLabel={false}
                        showCaption={false}
                        showSignedDate={false}
                      />
                    ) : (
                      <>
                        <p>{picRole},</p>
                        <div className="flex justify-center h-24 min-h-24">
                          {signature ? (
                            <img
                              src={signature}
                              alt="Tanda Tangan"
                              className="max-w-full max-h-24 object-contain"
                            />
                          ) : null}
                        </div>
                        <p className="min-h-[1.25rem]">{picName.trim() !== '' ? picName : '\u2014'}</p>
                        <p className="text-xs font-normal">
                          {picNumber.trim() !== '' ? `NIP. ${picNumber}` : 'NIP. \u2014'}
                        </p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
              <tr>
                <td className="font-semibold align-top border-2 py-0.5 px-2 border-black whitespace-nowrap overflow-hidden">
                  SOP
                </td>
                <td className="border-2 border-r-0 py-0.5 px-2 border-black text-center">:</td>
                <td className="font-semibold border-2 border-l-0 py-0.5 px-2 border-black min-w-0 break-words">{name || ' - '}</td>
              </tr>

              {/* DASAR HUKUM | KUALIFIKASI PELAKSANAAN */}
              <tr>
                <td className="font-semibold border-2 py-0.5 px-2 border-black overflow-hidden">DASAR HUKUM</td>
                <td colSpan={3} className="font-semibold border-2 py-0.5 px-2 border-black overflow-hidden">
                  KUALIFIKASI PELAKSANAAN
                </td>
              </tr>
              <tr>
                <td className="align-top border-2 py-0.5 px-2 border-black min-w-0 break-words">
                  {lawBasis.length > 0 ? (
                    <ol className="list-decimal list-outside ml-5 text-left break-words">
                      {lawBasis.map((item, i) => (
                        <li key={i} className="break-words">{item}</li>
                      ))}
                    </ol>
                  ) : (
                    <p> - </p>
                  )}
                </td>
                <td colSpan={3} className="align-top border-2 py-0.5 px-2 border-black min-w-0 break-words">
                  {implementQualification.length > 0 ? (
                    <ol className="list-decimal list-outside ml-5 text-left break-words">
                      {implementQualification.map((item, i) => (
                        <li key={i} className="break-words">{item}</li>
                      ))}
                    </ol>
                  ) : (
                    <p> - </p>
                  )}
                </td>
              </tr>

              {/* KETERKAITAN | PERALATAN */}
              <tr>
                <td className="font-semibold border-2 py-0.5 px-2 border-black overflow-hidden">
                  KETERKAITAN DENGAN SOP LAIN
                </td>
                <td colSpan={3} className="font-semibold border-2 py-0.5 px-2 border-black overflow-hidden">
                  PERALATAN / PERLENGKAPAN
                </td>
              </tr>
              <tr>
                <td className="align-top border-2 py-0.5 px-2 border-black min-w-0 break-words">
                  {relatedSop.length > 0 ? (
                    <ol className="list-decimal list-outside ml-5 text-left break-words">
                      {relatedSop.map((item, i) => (
                        <li key={i} className="break-words">{item}</li>
                      ))}
                    </ol>
                  ) : (
                    <p> - </p>
                  )}
                </td>
                <td colSpan={3} className="align-top border-2 py-0.5 px-2 border-black min-w-0 break-words">
                  {equipment.length > 0 ? (
                    <ol className="list-decimal list-outside ml-5 text-left break-words">
                      {equipment.map((item, i) => (
                        <li key={i} className="break-words">{item}</li>
                      ))}
                    </ol>
                  ) : (
                    <p> - </p>
                  )}
                </td>
              </tr>

              {/* PERINGATAN | PENCATATAN DAN PENDATAAN */}
              <tr>
                <td className="font-semibold border-2 py-0.5 px-2 border-black overflow-hidden">PERINGATAN</td>
                <td colSpan={3} className="font-semibold border-2 py-0.5 px-2 border-black overflow-hidden">
                  PENCATATAN DAN PENDATAAN
                </td>
              </tr>
              <tr>
                <td className="align-top border-2 py-0.5 px-2 border-black min-w-0 break-words">
                  {toArrayField(warning).length > 0 ? (
                    <ol className="list-decimal list-outside ml-5 text-left break-words">
                      {toArrayField(warning).map((item, i) => (
                        <li key={i} className="break-words">{item}</li>
                      ))}
                    </ol>
                  ) : (
                    <p> - </p>
                  )}
                </td>
                <td colSpan={3} className="align-top border-2 py-0.5 px-2 border-black min-w-0 break-words">
                  {recordData.length > 0 ? (
                    <ul className="m-0 list-none p-0 text-left break-words space-y-1">
                      {recordData.map((item, i) => (
                        <li key={i} className="break-words p-0">
                          - {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p> - </p>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
