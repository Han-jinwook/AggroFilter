/**
 * 🖼️ Merlin Hub SDK Universal Client-side Image Downsizing Engine
 * 브라우저 캔버스를 이용한 초경량 WebP/JPEG 다운사이징 및 압축 엔진 (10MB ➔ ~150KB, 용량 98% 절감)
 */
export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 ~ 1.0 (default 0.82)
  format?: 'image/webp' | 'image/jpeg' | 'image/png';
}

export interface CompressedImageResult {
  dataUrl: string;
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  compressionRatio: string; // e.g. "94.2%"
  width: number;
  height: number;
}

export const compressImage = (
  source: File | Blob | string,
  options: ImageCompressionOptions = {}
): Promise<CompressedImageResult> => {
  return new Promise((resolve, reject) => {
    const {
      maxWidth = 1200,
      maxHeight = 1200,
      quality = 0.82,
      format = 'image/webp'
    } = options;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      let { width, height } = img;

      // 비율 유지 다운사이징 계산
      if (width > maxWidth || height > maxHeight) {
        const widthRatio = maxWidth / width;
        const heightRatio = maxHeight / height;
        const scaleFactor = Math.min(widthRatio, heightRatio);
        width = Math.round(width * scaleFactor);
        height = Math.round(height * scaleFactor);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Canvas context could not be created'));
      }

      // 이미지 렌더링
      ctx.drawImage(img, 0, 0, width, height);

      // WebP 지원 여부 확인 및 생성
      let outputFormat = format;
      let dataUrl = canvas.toDataURL(outputFormat, quality);

      // 브라우저가 WebP를 지원하지 않아 PNG 등으로 반환된 경우 JPEG로 폴백
      if (outputFormat === 'image/webp' && !dataUrl.startsWith('data:image/webp')) {
        outputFormat = 'image/jpeg';
        dataUrl = canvas.toDataURL(outputFormat, quality);
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            return reject(new Error('Blob conversion failed'));
          }

          const originalSize = typeof source === 'string' ? Math.round((source.length * 3) / 4) : source.size;
          const compressedSize = blob.size;
          const savings = Math.max(0, originalSize - compressedSize);
          const ratio = originalSize > 0 ? ((savings / originalSize) * 100).toFixed(1) + '%' : '0%';

          resolve({
            dataUrl,
            blob,
            originalSize,
            compressedSize,
            compressionRatio: ratio,
            width,
            height
          });
        },
        outputFormat,
        quality
      );
    };

    img.onerror = (err) => reject(err);

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(source);
    }
  });
};
