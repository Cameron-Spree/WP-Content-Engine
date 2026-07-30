/**
 * Client-Side Image Compressor & Downscaler
 * Optimizes large images (e.g. 8MB+ camera photos) to stay under Vercel's 4.5MB payload limit.
 */

export async function compressImageIfNeeded(file, maxMb = 3.5) {
  const maxBytes = maxMb * 1024 * 1024;
  
  // If file is already smaller than limit and is not giant, return as-is
  if (file.size <= maxBytes) {
    return file;
  }

  console.log(`Image ${file.name} is ${ (file.size / (1024*1024)).toFixed(2) } MB. Downscaling for web upload...`);

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Max dimensions for web blog images (2048px is standard 2K max width)
      const MAX_WIDTH = 2048;
      const MAX_HEIGHT = 2048;

      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        if (width > height) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        } else {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // Export canvas as optimized JPEG blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file); // Fallback to original if canvas fails
            return;
          }
          const compressedFile = new File([blob], file.name, {
            type: "image/jpeg",
            lastModified: Date.now()
          });
          console.log(`Optimized ${file.name}: ${ (file.size / (1024*1024)).toFixed(2) } MB -> ${ (compressedFile.size / (1024*1024)).toFixed(2) } MB`);
          resolve(compressedFile);
        },
        "image/jpeg",
        0.85 // 85% high quality compression
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
