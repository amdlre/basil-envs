export { encrypt } from './encrypt';
export { decrypt, DecryptionError } from './decrypt';
export type { CryptoOptions, EncryptedPayload } from './types';

/** AAD binding an encrypted value to its row, so ciphertexts can't be swapped between rows. */
export const variableAad = (environmentId: string, key: string) => `${environmentId}:${key}`;
