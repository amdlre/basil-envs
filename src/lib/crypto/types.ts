/** AES-256-GCM payload as stored in `env_variables` (all fields base64). */
export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

export type CryptoOptions = {
  /**
   * Additional authenticated data. Not secret, not stored — but must be identical on
   * decrypt. Binding ciphertext to its row (e.g. `${environmentId}:${key}`) prevents
   * swapping encrypted values between rows at the database level.
   */
  aad?: string;
  /** Override the master key (tests / key rotation). Defaults to MASTER_ENCRYPTION_KEY. */
  key?: Buffer;
};

export const ALGORITHM = 'aes-256-gcm';
/** 96-bit IV — the GCM-recommended size. */
export const IV_BYTES = 12;
/** 128-bit authentication tag. */
export const AUTH_TAG_BYTES = 16;
