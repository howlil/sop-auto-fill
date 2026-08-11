import type { RoleKey } from '@/types/dto/access.dto';
import { ROUTES } from '@/utils/constants';
import { toNavigationRole } from '@/utils/role-key';

/**
 * Halaman pertama sidebar per peran (indeks 0) — dipakai untuk redirect `/` dan setelah login.
 */
export const ROLE_DEFAULT_LANDING: Record<RoleKey, string> = {
  PJ_EVALUATOR: ROUTES.PJ_EVALUATOR.GRAFIK_EVALUASI,
  PENYUSUN: ROUTES.PENYUSUN.SOP,
  PJ_PENYUSUN: ROUTES.PENYUSUN.SOP,
  KEPALA_OPD: ROUTES.KEPALA_OPD.SOP,
  EVALUATOR: ROUTES.EVALUATOR.EVALUASI,
};

/** Prefiks area aplikasi yang dibatasi per peran (guard kasar untuk redirect aman). */
const ROLE_ROUTE_PREFIXES: { prefix: string; roles: RoleKey[] }[] = [
  { prefix: '/pj-evaluator', roles: ['PJ_EVALUATOR'] },
  {
    prefix: '/penyusun',
    roles: ['PENYUSUN', 'PJ_PENYUSUN'],
  },
  { prefix: '/kepala-opd', roles: ['KEPALA_OPD'] },
  { prefix: '/evaluator', roles: ['EVALUATOR'] },
];

/** Peran yang boleh mengatur PIN / memanggil API `/tte` (selaras server `TteController`). */
export const ROLES_DENGAN_TTE = [
  'PJ_EVALUATOR',
  'PJ_PENYUSUN',
  'KEPALA_OPD',
] as const satisfies readonly RoleKey[];

export function roleMendukungTte(role: RoleKey | undefined): boolean {
  if (role === undefined) {
    return false;
  }
  return (ROLES_DENGAN_TTE as readonly RoleKey[]).includes(role);
}

/** Route halaman profil akun (`/me`) per peran navigasi; `undefined` jika peran tidak punya halaman profil. */
export function getMeRoute(role: RoleKey | undefined): string | undefined {
  switch (role) {
    case 'PJ_EVALUATOR':
      return ROUTES.PJ_EVALUATOR.ME;
    case 'KEPALA_OPD':
      return ROUTES.KEPALA_OPD.ME;
    case 'PENYUSUN':
    case 'PJ_PENYUSUN':
      return ROUTES.PENYUSUN.ME;
    case 'EVALUATOR':
      return ROUTES.EVALUATOR.ME;
    default:
      return undefined;
  }
}

export function getRoleDefaultLandingPath(peran: string): string | undefined {
  const navRole = toNavigationRole(peran);
  if (navRole === undefined) {
    return undefined;
  }
  return ROLE_DEFAULT_LANDING[navRole];
}

export function isPathAccessibleByRole(pathname: string, peran: string): boolean {
  const navRole = toNavigationRole(peran);
  if (navRole === undefined) {
    return false;
  }
  const match = ROLE_ROUTE_PREFIXES.find(
    (p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`),
  );
  if (!match) {
    return false;
  }
  return match.roles.includes(navRole);
}

/**
 * Ekstrak path internal dari query `redirect` (hanya origin yang sama; cegah open redirect).
 */
export function parseSafeInternalRedirect(redirect: string | undefined): string | null {
  if (redirect == null || String(redirect).trim() === '') {
    return null;
  }
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = redirect.trim();
    const url = raw.startsWith('http') ? new URL(raw) : new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) {
      return null;
    }
    const path = `${url.pathname}${url.search}${url.hash}`;
    if (path === '/' || path.startsWith('/login')) {
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

/**
 * Tujuan setelah login: gunakan `redirect` hanya jika internal & cocok dengan peran; selain itu landing peran (sidebar indeks 0).
 */
export function resolvePostLoginPath(redirect: string | undefined, peran: string): string {
  const internal = parseSafeInternalRedirect(redirect);
  if (internal) {
    const pathname = internal.split('?')[0]?.split('#')[0] ?? '';
    if (pathname && isPathAccessibleByRole(pathname, peran)) {
      return internal;
    }
  }
  return getRoleDefaultLandingPath(peran) ?? ROUTES.HOME;
}

type NavigateLike = (opts: {
  to: string;
  search?: Record<string, string>;
  hash?: `#${string}`;
}) => void;

/** Navigasi ke path yang bisa berisi query/hash (hasil `resolvePostLoginPath`). */
export function navigateToAppPath(navigate: NavigateLike, pathWithQueryHash: string): void {
  const url = new URL(pathWithQueryHash, window.location.origin);
  const search: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    search[key] = value;
  });
  navigate({
    to: url.pathname,
    ...(Object.keys(search).length > 0 ? { search } : {}),
    ...(url.hash ? { hash: url.hash as `#${string}` } : {}),
  });
}

/** Argumen untuk `redirect()` — sama dengan pola `navigateToAppPath` (untuk beforeLoad). */
export function redirectArgsFromAppPath(pathWithQueryHash: string): {
  to: string;
  search?: Record<string, string>;
  hash?: `#${string}`;
} {
  const base =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const url = new URL(pathWithQueryHash, base);
  const search: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    search[key] = value;
  });
  return {
    to: url.pathname,
    ...(Object.keys(search).length > 0 ? { search } : {}),
    ...(url.hash ? { hash: url.hash as `#${string}` } : {}),
  };
}
