type EncryptedCardPayload = { iv: string; ciphertext: string };

const decodeBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
const decodeKey = (value: string) =>
    /^[0-9a-f]{64}$/i.test(value)
        ? Uint8Array.from(value.match(/.{2}/g)!, (byte) => Number.parseInt(byte, 16))
        : decodeBase64(value);

export async function decryptCardPayload<T>({ iv, ciphertext }: EncryptedCardPayload) {
    const value = process.env.NEXT_PUBLIC_CARD_PAYLOAD_KEY;
    if (!value) throw new Error('Thiếu NEXT_PUBLIC_CARD_PAYLOAD_KEY.');

    const keyBytes = decodeKey(value);
    if (keyBytes.byteLength !== 32) {
        throw new Error('NEXT_PUBLIC_CARD_PAYLOAD_KEY phải là Base64 32 byte hoặc 64 ký tự hex.');
    }

    const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: decodeBase64(iv) },
        key,
        decodeBase64(ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
