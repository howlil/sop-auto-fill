import logoSvg from '@/assets/logo.svg'

/** Logo SIS SOP di pojok kanan bawah setiap halaman cetak diagram (hanya @media print). */
export function SopPrintBrandMark() {
  return (
    <img
      src={logoSvg}
      alt=""
      className="sop-print-brand-mark pointer-events-none"
      aria-hidden
      width={32}
      height={32}
    />
  )
}
