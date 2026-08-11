/**
 * Login Form - Modern Clean Design
 *
 * Design: Clean, minimalist, futuristic
 * - Simple, focused layout
 * - Clear visual hierarchy
 * - Professional aesthetic
 */
import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_DISPLAY_NAME } from "@/config/env";
import { Link } from "@tanstack/react-router";
import type { LoginRequestDto } from "@/types/dto/auth.dto";

export interface LoginFormProps {
  isSubmitting: boolean;
  onSubmitLogin: (payload: LoginRequestDto) => Promise<unknown>;
}

export function LoginForm({ isSubmitting, onSubmitLogin }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const validateForm = () => {
    let nextEmailError = "";
    let nextPasswordError = "";

    if (!email) {
      nextEmailError = "Email wajib diisi";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        nextEmailError = "Format email tidak valid";
      }
    }

    if (!password) {
      nextPasswordError = "Kata sandi wajib diisi";
    } else if (password.length < 8) {
      nextPasswordError = "Kata sandi minimal 8 karakter";
    }

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    return nextEmailError === "" && nextPasswordError === "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      // Navigation is handled in useAuth onSuccess hook
      await onSubmitLogin({ email, kataSandi: password });
    } catch (error: unknown) {
      // Error is already handled by useAuth's onError (shows toast)
      // Only handle field-specific errors here
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (message.includes("email")) {
          setEmailError(error.message);
        } else if (
          message.includes("password") ||
          message.includes("kata sandi")
        ) {
          setPasswordError(error.message);
        }
      }
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <Button
          asChild
          variant="ghost"
          className="mb-6 -ml-4 text-muted-foreground hover:text-foreground"
        >
          <Link to="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Beranda
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground mb-1">
          Selamat Datang
        </h1>
        <p className="text-sm text-muted-foreground">Masuk ke {APP_DISPLAY_NAME}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email Field */}
        <div className="space-y-2">
          <Label htmlFor="email" required>
            Email
          </Label>
          <div className="relative">
            <Mail
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
              aria-hidden
            />
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@instansi.go.id"
              disabled={isSubmitting}
              autoComplete="email"
              errorMessage={emailError}
              className="pl-10"
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <Label htmlFor="password" required>
            Kata sandi
          </Label>
          <div className="relative">
            <Lock
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
              aria-hidden
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan kata sandi"
              disabled={isSubmitting}
              autoComplete="current-password"
              errorMessage={passwordError}
              className="pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded text-muted-foreground transition-colors hover:text-secondary-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isSubmitting}
              aria-label={
                showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
              }
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          variant="default"
          size="lg"
          className="w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Memproses...
            </>
          ) : (
            <>
              Masuk
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </form>
      <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
        Kesulitan masuk? Hubungi administrator instansi Anda.
      </p>
    </div>
  );
}
