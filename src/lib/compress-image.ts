function sanitizeFilename(filename: string, extension: string) {
  const nameParts = filename.split(".");
  const baseName = nameParts.slice(0, -1).join(".") || nameParts[0] || "image";
  const safeBase = baseName
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .slice(0, 120);
  const safeExt = extension.replace(/[^a-zA-Z0-9]/g, "") || "webp";
  return `${safeBase || "image"}.${safeExt}`;
}

export async function compressImage(file: File): Promise<File> {
  const { default: imageCompression } = await import("browser-image-compression");
  const targetType = "image/webp";
  const initialOptions = {
    maxSizeMB: 1.2,
    maxWidthOrHeight: 1600,
    useWebWorker: true,
    initialQuality: 0.7,
    fileType: targetType
  } as const;

  const safeName = sanitizeFilename(file.name, "webp");

  async function createCompressedFile(options: Parameters<typeof imageCompression>[1]) {
    const compressedResult = await imageCompression(file, options);
    const blob = compressedResult instanceof File ? compressedResult : compressedResult;
    const extension = options.fileType?.split("/")[1] || "webp";
    const fileName = sanitizeFilename(file.name, extension);
    return new File([blob], fileName, { type: blob.type || options.fileType || file.type });
  }

  try {
    return await createCompressedFile(initialOptions);
  } catch (error) {
    const fallbackType = file.type === "image/jpeg" || file.type === "image/webp" ? file.type : "image/jpeg";
    try {
      return await createCompressedFile({
        ...initialOptions,
        fileType: fallbackType
      });
    } catch (fallbackError) {
      throw new Error("Зураг шахах эсвэл upload хийхэд алдаа гарлаа.");
    }
  }
}
