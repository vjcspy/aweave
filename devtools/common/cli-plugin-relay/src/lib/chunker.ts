/** Hard cap for raw chunk size — base64 + JSON must fit in Vercel 4.5MB limit */
const CHUNK_HARD_CAP = 3_400_000;

/** Minimum chunk size to prevent excessive request count */
const CHUNK_MIN_SIZE = 65_536; // 64 KB

/** Default chunk size: 3 MB */
export const DEFAULT_CHUNK_SIZE = 3 * 1024 * 1024;

/**
 * Split a buffer into chunks of the given size.
 *
 * @param data - Buffer to split
 * @param chunkSize - Max bytes per chunk (default: 3MB)
 * @returns Array of buffer chunks
 * @throws If chunkSize exceeds hard cap or is below minimum
 */
export function splitIntoChunks(data: Buffer, chunkSize: number = DEFAULT_CHUNK_SIZE): Buffer[] {
  if (chunkSize > CHUNK_HARD_CAP) {
    throw new Error(
      `Chunk size ${chunkSize} exceeds hard cap of ${CHUNK_HARD_CAP} bytes. ` +
      'Base64 + JSON envelope must fit within Vercel 4.5MB body limit.',
    );
  }

  if (chunkSize < CHUNK_MIN_SIZE) {
    throw new Error(
      `Chunk size ${chunkSize} is below minimum of ${CHUNK_MIN_SIZE} bytes. ` +
      'Small chunks create excessive HTTP requests.',
    );
  }

  const chunks: Buffer[] = [];
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    chunks.push(data.subarray(offset, offset + chunkSize));
  }

  return chunks;
}
