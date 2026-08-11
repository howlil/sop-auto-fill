

export const ErrorCodes = {
  SINGLETON_CONSTRAINT_VIOLATION: 'SINGLETON_CONSTRAINT_VIOLATION',
  USER_EMAIL_EXISTS: 'USER_EMAIL_EXISTS',
  USER_NIP_EXISTS: 'USER_NIP_EXISTS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  TIM_ALREADY_EXISTS: 'TIM_ALREADY_EXISTS',
  TIM_NOT_FOUND: 'TIM_NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  code: ErrorCode;
  message: string;
  errors?: string[];
  path: string;
  timestamp: string;
}


export function getUserFriendlyMessage(error: unknown): string {
  if (!error) return 'Terjadi kesalahan tidak diketahui';
  
  // Check if it's an API error response
  const apiError = error as ApiErrorResponse;
  
  if (apiError?.code) {
    switch (apiError.code) {
      case ErrorCodes.SINGLETON_CONSTRAINT_VIOLATION:
        if (apiError.message.includes('Kepala OPD')) {
          return 'OPD ini sudah memiliki Kepala OPD aktif. Nonaktifkan Kepala OPD saat ini terlebih dahulu, atau pilih OPD lain.';
        }
        if (apiError.message.includes('Koordinator')) {
          return 'OPD ini sudah memiliki PJ Penyusun aktif. Nonaktifkan PJ Penyusun saat ini terlebih dahulu, atau pilih OPD lain.';
        }
        return 'Data sudah ada. Silakan periksa kembali data yang Anda masukkan.';
      
      case ErrorCodes.USER_EMAIL_EXISTS:
        return 'Email sudah terdaftar. Gunakan email lain atau coba login.';
      
      case ErrorCodes.USER_NIP_EXISTS:
        return 'NIP sudah terdaftar. Gunakan NIP lain atau periksa kembali.';
      
      case ErrorCodes.TIM_ALREADY_EXISTS:
        return 'User sudah menjadi anggota tim di OPD ini.';
      
      case ErrorCodes.VALIDATION_ERROR:
        return 'Data yang Anda masukkan tidak valid. Periksa kembali form.';
      
      case ErrorCodes.FORBIDDEN:
        return 'Anda tidak memiliki akses ke fitur ini.';
      
      case ErrorCodes.UNAUTHORIZED:
        return 'Sesi Anda telah berakhir. Silakan login kembali.';
      
      default:
        return apiError.message || 'Terjadi kesalahan. Silakan coba lagi.';
    }
  }

  if (apiError?.message) {
    if (apiError.message.includes('Nomor dokumen sudah digunakan')) {
      return 'Nomor dokumen sudah digunakan. Gunakan nomor dokumen lain.';
    }
    if (apiError.message.includes('Langkah tujuan harus berada dalam DetailSOP yang sama')) {
      return 'Langkah tujuan harus berada dalam SOP yang sama.';
    }
  }
  
  // Fallback to error message if it's a regular Error object
  if (error instanceof Error) {
    if (error.message.includes('Nomor dokumen sudah digunakan')) {
      return 'Nomor dokumen sudah digunakan. Gunakan nomor dokumen lain.';
    }
    if (error.message.includes('Langkah tujuan harus berada dalam DetailSOP yang sama')) {
      return 'Langkah tujuan harus berada dalam SOP yang sama.';
    }
    return error.message;
  }
  
  return 'Terjadi kesalahan tidak diketahui';
}

export function isErrorCode(error: unknown, code: ErrorCode): boolean {
  const apiError = error as ApiErrorResponse;
  return apiError?.code === code;
}
