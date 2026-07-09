/**
 * Wire + domain types for the "secret-image" tool.
 *
 * SECURITY MODEL (end-to-end): the AES key that decrypts a folder never leaves
 * the browser — it lives only inside the share code / URL fragment. The server
 * and R2 only ever handle ciphertext plus per-file IVs. Therefore NONE of the
 * types crossing the network carry plaintext image bytes, filenames or MIME
 * types: the original name + type are themselves encrypted into `metaCipher`.
 */

/** Per-file metadata the client sends when creating a share. All non-secret. */
export interface CreateFileInput {
  /** Base64 IV used for the image ciphertext (AES-GCM). */
  imageIv: string;
  /** Base64 ciphertext of the JSON `{ name, type }` blob. */
  metaCipher: string;
  /** Base64 IV used for `metaCipher`. */
  metaIv: string;
  /** Byte length of the encrypted image blob (for server-side limit checks). */
  size: number;
}

export interface CreateShareRequest {
  files: CreateFileInput[];
}

/** One upload target returned by the create endpoint. */
export interface UploadTarget {
  /** Opaque R2 object key the client must PUT its ciphertext to. */
  objectKey: string;
  /** Short-lived presigned PUT URL for that object. */
  url: string;
}

export interface CreateShareResponse {
  /** The share id (path segment); combined with the key to form the code. */
  id: string;
  /** Presigned PUT targets, aligned by index with the request `files`. */
  uploads: UploadTarget[];
  error?: string;
}

/** One file as returned to a viewer: still fully encrypted. */
export interface ViewFile {
  imageIv: string;
  metaCipher: string;
  metaIv: string;
  /** Short-lived presigned GET URL for the encrypted image blob. */
  url: string;
}

export interface ViewShareResponse {
  files: ViewFile[];
  error?: string;
}

/** The plaintext metadata that lives (encrypted) inside `metaCipher`. */
export interface FileMeta {
  name: string;
  type: string;
}
