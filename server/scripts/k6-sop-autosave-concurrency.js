import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Counter, Rate } from 'k6/metrics'

const BASE_URL = __ENV.API_BASE_URL || 'http://127.0.0.1:3000/api/v1'
const EMAIL_A = __ENV.USER_A_EMAIL || 'penyusun.dinkes@gmail.com'
const EMAIL_B = __ENV.USER_B_EMAIL || 'pjpenyusun.dinkes@gmail.com'
const PASSWORD_A = __ENV.USER_A_PASSWORD || __ENV.SEED_PASSWORD || '@Password123:)'
const PASSWORD_B = __ENV.USER_B_PASSWORD || __ENV.SEED_PASSWORD || '@Password123:)'

export const options = {
  scenarios: {
    autosave_concurrency: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 20),
      duration: __ENV.DURATION || '1m',
      gracefulStop: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000', 'p(99)<3000'],
    autosave_success_rate: ['rate>0.99'],
    conflict_or_validation_errors: ['count==0'],
  },
}

export const autosaveSuccessRate = new Rate('autosave_success_rate')
export const conflictOrValidationErrors = new Counter('conflict_or_validation_errors')
let failedAutosaveSamples = 0

export function setup() {
  const userA = login(EMAIL_A, PASSWORD_A)
  const userB = login(EMAIL_B, PASSWORD_B)
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
  const sop = post(
    '/sop',
    {
      judul: `K6 Concurrency SOP ${suffix}`,
      nomorSop: `K6/CONC/${suffix}`,
      namaLembaga: 'Biro Organisasi Sumbar',
    },
    userA.cookie,
  )
  const pelaksana = post(
    '/pelaksana',
    { namaPelaksana: `Pelaksana K6 ${suffix}` },
    userA.cookie,
  )

  return {
    detailSopId: sop.detailSopId,
    pelaksanaId: pelaksana.id,
    userA,
    userB,
  }
}

export default function (data) {
  const actor = __VU % 2 === 0 ? data.userA : data.userB
  const marker = `vu-${__VU}-iter-${__ITER}-${Date.now()}`

  group('parallel-like autosave header', () => {
    const response = patch(
      `/sop/header/${data.detailSopId}?logsLimit=25`,
      {
        namaLembaga: `Biro Organisasi Sumbar ${marker}`,
        lampiran: {
          peringatan: [`Peringatan ${marker}`],
        },
      },
      actor.cookie,
    )
    recordAutosave(response, 'header autosave ok')
  })

  group('parallel-like autosave prosedur replace-all', () => {
    const response = patch(
      `/sop/langkah/${data.detailSopId}?logsLimit=25`,
      {
        pelaksana: [{ pelaksanaId: data.pelaksanaId }],
        langkah: [
          {
            tempId: `${marker}-mulai`,
            jenis: 'AWAL_AKHIR',
            kegiatan: `Mulai ${marker}`,
            kelengkapan: 'Berkas',
            keluaran: 'Dokumen diterima',
            waktu: 5,
            satuanWaktu: 'm',
            keterangan: 'Autosave k6',
            pelaksanaId: data.pelaksanaId,
          },
          {
            tempId: `${marker}-selesai`,
            jenis: 'AWAL_AKHIR',
            kegiatan: `Selesai ${marker}`,
            kelengkapan: 'Berkas akhir',
            keluaran: 'Dokumen selesai',
            waktu: 5,
            satuanWaktu: 'm',
            keterangan: 'Autosave k6',
            pelaksanaId: data.pelaksanaId,
          },
        ],
      },
      actor.cookie,
    )
    recordAutosave(response, 'prosedur autosave ok')
  })

  sleep(Number(__ENV.THINK_TIME_SECONDS || 0.3))
}

export function teardown(data) {
  const response = get(`/sop/penyusun-workbench/${data.detailSopId}?logsLimit=50`, data.userA.cookie)
  check(response, {
    'final workbench readable': (res) => res.status === 200,
    'final workbench has two prosedur rows': (res) => {
      const body = parseJson(res)
      return Array.isArray(body?.data?.langkah) && body.data.langkah.length === 2
    },
  })
}

function login(email, password) {
  const response = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    jsonParams(),
  )
  const ok = check(response, {
    [`login ok: ${email}`]: (res) => res.status >= 200 && res.status < 300,
  })
  if (!ok) {
    throw new Error(
      `Login ${email} gagal di ${BASE_URL}/auth/login: status=${response.status}, body=${truncate(
        response.body,
      )}`,
    )
  }
  const cookie = cookieHeader(response)
  if (!cookie) {
    throw new Error(
      `Login ${email} berhasil tetapi tidak mengembalikan cookie. Header=${JSON.stringify(
        response.headers,
      )}`,
    )
  }
  return { email, cookie }
}

function get(path, cookie) {
  return http.get(`${BASE_URL}${path}`, authParams(cookie))
}

function post(path, body, cookie) {
  const response = http.post(`${BASE_URL}${path}`, JSON.stringify(body), authParams(cookie))
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`POST ${path} gagal: ${response.status} ${response.body}`)
  }
  return parseJson(response).data
}

function patch(path, body, cookie) {
  return http.patch(`${BASE_URL}${path}`, JSON.stringify(body), authParams(cookie))
}

function recordAutosave(response, label) {
  const ok = check(response, {
    [label]: (res) => res.status === 200,
  })
  autosaveSuccessRate.add(ok)
  if ([400, 409, 422, 500].includes(response.status)) {
    conflictOrValidationErrors.add(1)
  }
  if (!ok && failedAutosaveSamples < 5) {
    failedAutosaveSamples += 1
    console.error(
      `${label} failed: status=${response.status}, body=${truncate(response.body)}`,
    )
  }
}

function authParams(cookie) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
  }
}

function jsonParams() {
  return {
    headers: {
      'Content-Type': 'application/json',
    },
  }
}

function cookieHeader(response) {
  const accessToken = response.cookies.access_token?.[0]?.value
  const refreshToken = response.cookies.refresh_token?.[0]?.value
  return [
    accessToken ? `access_token=${accessToken}` : '',
    refreshToken ? `refresh_token=${refreshToken}` : '',
  ]
    .filter(Boolean)
    .join('; ')
}

function parseJson(response) {
  try {
    return response.json()
  } catch {
    return null
  }
}

function truncate(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return text.length > 500 ? `${text.slice(0, 500)}...` : text
}
