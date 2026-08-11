import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/utils/constants'

interface RouteErrorPageProps {
  error: unknown
  reset: () => void
}

export function RouteErrorPage({ error, reset }: RouteErrorPageProps) {
  const message = error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak terduga.'

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-b from-gray-50 to-white px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-red-100 bg-surface p-6 shadow-surface">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <h1 className="text-xl font-semibold leading-7 text-foreground">Terjadi kesalahan</h1>
        <p className="mt-2 text-sm text-secondary-foreground">
          Aplikasi gagal memproses halaman ini. Silakan muat ulang atau kembali ke beranda.
        </p>
        <p className="mt-3 rounded-md border border-red-100 bg-red-50 p-3 text-xs text-red-700">{message}</p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button className="gap-2" onClick={reset}>
            <RefreshCw className="h-4 w-4" />
            Coba Lagi
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to={ROUTES.HOME} search={{ denied: undefined, redirect: undefined }}>
              <Home className="h-4 w-4" />
              Kembali ke Beranda
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
