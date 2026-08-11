
import {
  Shield,
  CheckCircle,
  Zap,
  ArrowUpRight,
} from "lucide-react";

export function LoginHero() {
  return (
    <div className="flex flex-col justify-center h-full text-white relative">
      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* Gradient Orbs */}
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-blue-400/30 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-indigo-400/20 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl" />

      {/* Animated Dots */}
      <div className="absolute top-20 left-16 w-2 h-2 bg-blue-300/50 rounded-full" />
      <div className="absolute top-40 right-24 w-1.5 h-1.5 bg-cyan-300/40 rounded-full" />
      <div className="absolute bottom-32 left-24 w-2 h-2 bg-indigo-300/50 rounded-full" />
      <div className="absolute top-1/2 right-8 w-1.5 h-1.5 bg-blue-300/30 rounded-full" />

      {/* Main Content */}
      <div className="relative z-10">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4 leading-tight">
            Pengelolaan SOP AP
            <br />
            <span className="bg-gradient-to-r from-blue-200 to-cyan-200 bg-clip-text text-transparent">
              Terpadu dan Teraudit
            </span>
          </h1>
          <p className="text-sm text-blue-100/70 leading-relaxed max-w-sm">
            Penyusunan, evaluasi, verifikasi, dan pengesahan SOP Administrasi
            Pemerintahan dalam satu sistem terintegrasi.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="space-y-3 mb-8">
          <div className="flex items-center gap-3 p-3 bg-surface/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-surface/10 transition-all group">
            <div className="w-9 h-9 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-lg flex items-center justify-center shrink-0 border border-green-400/20">
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white/90">
                Penyusunan hingga pengesahan
              </p>
              <p className="text-xs text-blue-200/60">
                Alur kerja dari draft di OPD sampai pengesahan TTE BSRE
              </p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
          </div>

          <div className="flex items-center gap-3 p-3 bg-surface/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-surface/10 transition-all group">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-lg flex items-center justify-center shrink-0 border border-blue-400/20">
              <Shield className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white/90">
                Evaluasi dan verifikasi berjenjang
              </p>
              <p className="text-xs text-blue-200/60">
                Penilaian Biro Organisasi dengan persetujuan bertingkat
              </p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
          </div>

          <div className="flex items-center gap-3 p-3 bg-surface/5 backdrop-blur-sm rounded-xl border border-white/10 hover:bg-surface/10 transition-all group">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-500/20 to-amber-600/20 rounded-lg flex items-center justify-center shrink-0 border border-amber-400/20">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white/90">
                Dashboard dan pelaporan
              </p>
              <p className="text-xs text-blue-200/60">
                Rekapitulasi data evaluasi dan statistik pengelolaan SOP
              </p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" />
          </div>
        </div>
      </div>
    </div>
  );
}
