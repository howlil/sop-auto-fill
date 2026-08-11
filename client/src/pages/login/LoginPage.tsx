import { useAuth } from "@/api/auth";
import { LoginForm } from "@/pages/login/components/LoginForm";
import { LoginHero } from "@/pages/login/components/LoginHero";
import logoSvg from "@/assets/logo.svg";
import { APP_DISPLAY_NAME } from "@/config/env";

export function LoginPage() {
  const { login, isLoggingIn } = useAuth();

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Left Panel - Futuristic Hero */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-700">
        {/* Subtle Grid */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }} />
        </div>

        {/* Soft Glow Orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-400/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-400/20 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative z-10 flex items-center w-full p-16">
          <LoginHero />
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex w-full items-center justify-center bg-surface lg:w-1/2">
        <div className="w-full max-w-md p-8">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src={logoSvg} alt={APP_DISPLAY_NAME} className="h-11 w-11" />
            <p className="text-sm font-semibold leading-tight text-foreground">
              {APP_DISPLAY_NAME}
            </p>
          </div>
          <LoginForm isSubmitting={isLoggingIn} onSubmitLogin={login} />
        </div>
      </div>
    </div>
  )
}
