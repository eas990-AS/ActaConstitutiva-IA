import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { deleteFile } from '../sync/files';

const MAX_SIDE = 1600;

/** Reduce la foto a máx. 1600 px por lado y la guarda como JPEG (calidad 0.7). */
export async function compressPhoto(uri: string, width: number, height: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  try {
    if (Math.max(width, height) > MAX_SIDE) {
      ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    }
    const image = await ctx.renderAsync();
    const result = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
    image.release();
    if (result.uri !== uri) deleteFile(uri);
    return result.uri;
  } finally {
    ctx.release();
  }
}
