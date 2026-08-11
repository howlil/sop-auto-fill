import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import type { BeritaAcaraTemplateProps } from '@/components/pengajuan/berita-acara-template'
import {
  BERITA_ACARA_KOP,
  BERITA_ACARA_LABEL_BIRO,
  BERITA_ACARA_LOKASI,
  BERITA_ACARA_PARAGRAF,
  BERITA_ACARA_PENUTUP,
  BERITA_ACARA_POIN_EVALUASI,
} from '@/lib/pengajuan/berita-acara-static-content'
import {
  BERITA_ACARA_A4_SIZE,
  BERITA_ACARA_MARGIN_BOTTOM_PT,
  BERITA_ACARA_MARGIN_SIDE_PT,
  BERITA_ACARA_MARGIN_TOP_PT,
} from '@/lib/pengajuan/berita-acara-page-metrics'
import { SOP_INSTITUTION_LOGO_URL } from '@/lib/sop/sop-institution-logo'
import { formatTempatTanggal } from '@/utils/format-date'

export interface BeritaAcaraPdfDocumentProps extends BeritaAcaraTemplateProps {
  qrDataUrlPjEvaluator?: string
  qrDataUrlPjPenyusun?: string
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Times-Roman',
    fontSize: 11,
    paddingTop: BERITA_ACARA_MARGIN_TOP_PT,
    paddingLeft: BERITA_ACARA_MARGIN_SIDE_PT,
    paddingRight: BERITA_ACARA_MARGIN_SIDE_PT,
    paddingBottom: BERITA_ACARA_MARGIN_BOTTOM_PT,
    color: '#000000',
  },
  kopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  logo: {
    width: 64,
    height: 80,
    objectFit: 'contain',
    marginRight: 12,
  },
  kopCenter: {
    flex: 1,
    textAlign: 'center',
  },
  kopProvinsi: {
    fontFamily: 'Times-Bold',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  kopLembaga: {
    fontFamily: 'Times-Bold',
    fontSize: 11,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  kopAlamat: {
    fontSize: 9,
    marginTop: 4,
    color: '#374151',
  },
  kopBorder: {
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    paddingBottom: 8,
    marginBottom: 16,
  },
  titleBlock: {
    textAlign: 'center',
    marginBottom: 16,
  },
  titleMain: {
    fontFamily: 'Times-Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  titleSub: {
    fontFamily: 'Times-Bold',
    fontSize: 11,
    textTransform: 'uppercase',
    lineHeight: 1.35,
    marginBottom: 4,
  },
  titleMeta: {
    fontSize: 9,
    marginTop: 4,
  },
  paragraph: {
    textAlign: 'justify',
    lineHeight: 1.45,
    marginBottom: 10,
  },
  listItem: {
    textAlign: 'justify',
    lineHeight: 1.4,
    marginBottom: 4,
    paddingLeft: 12,
  },
  dateLine: {
    textAlign: 'right',
    fontSize: 11,
    marginTop: 16,
    marginBottom: 20,
  },
  signatureRow: {
    flexDirection: 'row',
  },
  signatureBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 12,
    alignItems: 'center',
  },
  signatureBoxLeft: {
    marginRight: 24,
  },
  signatureLabel: {
    fontFamily: 'Times-Bold',
    fontSize: 9,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  qrImage: {
    width: 64,
    height: 64,
    marginBottom: 6,
  },
  signatureName: {
    fontFamily: 'Times-Bold',
    fontSize: 11,
  },
  signaturePlaceholder: {
    height: 48,
    marginBottom: 8,
  },
})

function SignatureBlock(props: {
  label: string
  name?: string
  qrDataUrl?: string
  isLeft?: boolean
}) {
  const { label, name, qrDataUrl, isLeft = false } = props
  const boxStyle = isLeft ? [styles.signatureBox, styles.signatureBoxLeft] : styles.signatureBox
  return (
    <View style={boxStyle}>
      <Text style={styles.signatureLabel}>{label}</Text>
      {qrDataUrl ? (
        <>
          <Image src={qrDataUrl} style={styles.qrImage} />
          <Text style={styles.signatureName}>{name ?? '—'}</Text>
        </>
      ) : (
        <>
          <View style={styles.signaturePlaceholder} />
          <Text style={styles.signatureName}>{name ?? '—'}</Text>
        </>
      )}
    </View>
  )
}

export function BeritaAcaraPdfDocument({
  opd,
  nomorBA,
  tanggalVerifikasi,
  namaBiro,
  namaPjPenyusun,
  qrDataUrlPjEvaluator,
  qrDataUrlPjPenyusun,
}: BeritaAcaraPdfDocumentProps) {
  const dateLine = formatTempatTanggal(
    tanggalVerifikasi ?? new Date().toISOString().slice(0, 10),
  )
  return (
    <Document title={`Berita Acara - ${opd}`}>
      <Page size={BERITA_ACARA_A4_SIZE} orientation="portrait" style={styles.page}>
        <View style={styles.kopBorder}>
          <View style={styles.kopRow}>
            <Image src={SOP_INSTITUTION_LOGO_URL} style={styles.logo} />
            <View style={styles.kopCenter}>
              <Text style={styles.kopProvinsi}>{BERITA_ACARA_KOP.provinsi}</Text>
              <Text style={styles.kopLembaga}>{BERITA_ACARA_KOP.lembaga}</Text>
              <Text style={styles.kopAlamat}>{BERITA_ACARA_KOP.alamat}</Text>
              <Text style={styles.kopAlamat}>{BERITA_ACARA_KOP.website}</Text>
            </View>
          </View>
        </View>

        <View style={styles.titleBlock}>
          <Text style={styles.titleMain}>Berita Acara</Text>
          <Text style={styles.titleSub}>
            Pelaksanaan Verifikasi dan Evaluasi Standar Operasional Prosedur (SOP)
            pada {opd} Provinsi Sumatera Barat
          </Text>
          {nomorBA ? <Text style={styles.titleMeta}>Nomor: {nomorBA}</Text> : null}
          <Text style={styles.titleMeta}>{BERITA_ACARA_LOKASI}</Text>
        </View>

        {BERITA_ACARA_PARAGRAF.map((paragraph) => (
          <Text key={paragraph.slice(0, 24)} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}

        {BERITA_ACARA_POIN_EVALUASI.map((item, index) => (
          <Text key={item.slice(0, 20)} style={styles.listItem}>
            {index + 1}. {item}
          </Text>
        ))}

        <Text style={styles.paragraph}>{BERITA_ACARA_PENUTUP}</Text>

        <Text style={styles.dateLine}>{dateLine}</Text>

        <View style={styles.signatureRow}>
          <SignatureBlock
            label={BERITA_ACARA_LABEL_BIRO}
            name={namaBiro}
            qrDataUrl={qrDataUrlPjEvaluator}
            isLeft
          />
          <SignatureBlock
            label={opd}
            name={namaPjPenyusun}
            qrDataUrl={qrDataUrlPjPenyusun}
          />
        </View>
      </Page>
    </Document>
  )
}
