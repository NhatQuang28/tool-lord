export type CipherMode = "encrypt" | "decrypt";

export interface CipherRequest {
  mode: CipherMode;
  /** The message (plaintext when encrypting, ciphertext when decrypting). */
  text: string;
  /** The user-provided key (combined server-side with the web secret key). */
  userKey: string;
  /** Id of the visual style/alphabet to use. */
  styleId: string;
}

export interface CipherResponse {
  result: string;
  error?: string;
}

/** A visual "font"/script used to render the ciphertext. */
export interface CipherStyle {
  id: string;
  name: string;
  /** A short preview snippet for pickers. */
  sample: string;
  /** Ordered, unique, single-code-point glyphs. length = numeral base. */
  glyphs: string[];
}
