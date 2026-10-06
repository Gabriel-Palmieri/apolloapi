import { isURL, ValidateBy } from 'class-validator';

export function isProductPhotoUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  if (value.startsWith('/produtos/')) {
    try {
      return /^\/produtos\/(?:[\p{L}\p{N}_-]+\/)*[\p{L}\p{N} _().-]+\.(?:jpe?g|png|webp|avif)$/iu.test(decodeURIComponent(value));
    } catch {
      return false;
    }
  }
  return isURL(value, { protocols: ['https'], require_protocol: true });
}

export function IsProductPhotoUrl() {
  return ValidateBy({
    name: 'isProductPhotoUrl',
    validator: {
      validate: isProductPhotoUrl,
      defaultMessage: () => 'Use uma imagem da pasta /produtos/ ou um endereço HTTPS válido.',
    },
  });
}
