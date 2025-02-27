export function getErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error?.message) {
    // Anchor hata mesajlarını temizle
    if (error.message.includes('custom program error:')) {
      return error.message.split('custom program error:')[1].trim();
    }
    return error.message;
  }

  return 'An unexpected error occurred';
} 