/**
 * Utility for End-to-End Encryption (E2EE) using Web Crypto API.
 * Uses PBKDF2 for key derivation and AES-GCM for encryption/integrity.
 */

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_DERIVATION_ALGORITHM = 'PBKDF2';
const HASH_ALGORITHM = 'SHA-256';
const ITERATIONS = 100000;
const SALT = new TextEncoder().encode('VibeSync-E2EE-Salt-2026'); // Fixed salt for room-code derivation

/**
 * Derives a CryptoKey from a room code.
 */
export async function deriveKey(roomCode) {
    const encoder = new TextEncoder();
    const baseKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(roomCode.toUpperCase()),
        { name: KEY_DERIVATION_ALGORITHM },
        false,
        ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
        {
            name: KEY_DERIVATION_ALGORITHM,
            salt: SALT,
            iterations: ITERATIONS,
            hash: HASH_ALGORITHM,
        },
        baseKey,
        { name: ENCRYPTION_ALGORITHM, length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypts data (string or object) using the given key.
 * Returns a base64 string containing { iv, ciphertext }.
 */
export async function encryptData(data, key) {
    if (!key) return data;
    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
    
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: ENCRYPTION_ALGORITHM, iv },
        key,
        encoder.encode(plaintext)
    );

    // Combine IV and ciphertext for transmission
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a base64 string back into original data.
 */
export async function decryptData(encryptedBase64, key) {
    if (!key || !encryptedBase64 || typeof encryptedBase64 !== 'string') return encryptedBase64;
    
    try {
        const combined = new Uint8Array(
            atob(encryptedBase64).split('').map(c => c.charCodeAt(0))
        );
        
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);

        const decrypted = await window.crypto.subtle.decrypt(
            { name: ENCRYPTION_ALGORITHM, iv },
            key,
            ciphertext
        );

        const decoded = new TextDecoder().decode(decrypted);
        try {
            return JSON.parse(decoded);
        } catch {
            return decoded;
        }
    } catch (err) {
        console.error('Decryption failed:', err);
        return '[Encrypted Message]';
    }
}

/**
 * Encrypts a File or Blob.
 * Returns a new Blob containing [IV(12 bytes) + Ciphertext].
 */
export async function encryptFile(file, key) {
    if (!key) return file;
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const arrayBuffer = await file.arrayBuffer();

    const ciphertext = await window.crypto.subtle.encrypt(
        { name: ENCRYPTION_ALGORITHM, iv },
        key,
        arrayBuffer
    );

    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return new Blob([combined], { type: 'application/octet-stream' });
}

/**
 * Decrypts an encrypted Blob.
 * Returns a new Blob with the original media type.
 */
export async function decryptFile(encryptedBlob, key, originalType = 'video/mp4') {
    if (!key) return encryptedBlob;
    const combined = new Uint8Array(await encryptedBlob.arrayBuffer());

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
        { name: ENCRYPTION_ALGORITHM, iv },
        key,
        ciphertext
    );

    return new Blob([decrypted], { type: originalType });
}
