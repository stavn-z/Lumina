import { supa } from "./supa.ts";

// Envio de imagens ao bucket público "imagens". Cada envio gera um caminho novo
// (sem sobrescrever), então a URL pública devolvida é permanente — é ela que vai
// para o banco e para o HTML do e-mail (nunca base64).

const BUCKET = 'imagens';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

export class ImageUploadError extends Error {}

export function dataUrlToBlob(u: string): Blob {
  const [h, b] = u.split(',');
  const mime = (h.match(/data:([^;]+)/) || [])[1] || 'image/png';
  const bin = atob(b);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function uploadImage(file: Blob): Promise<string> {
  const ext = EXT[file.type];
  if (!ext) throw new ImageUploadError('Formato não aceito. Use PNG, JPG, GIF ou WebP.');
  if (file.size > MAX_IMAGE_BYTES) throw new ImageUploadError('A imagem passa de 5 MB. Reduza o tamanho e tente de novo.');
  const now = new Date();
  const path = `templates/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
  const storage = supa().storage.from(BUCKET);
  const { error } = await storage.upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
  if (error) throw new ImageUploadError('Não foi possível enviar a imagem: ' + (error.message || 'erro desconhecido'));
  return storage.getPublicUrl(path).data.publicUrl as string;
}
