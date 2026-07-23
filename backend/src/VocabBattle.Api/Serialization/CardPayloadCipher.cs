using System.Security.Cryptography;
using System.Text.Json;

namespace VocabBattle.Api.Serialization;

public sealed class CardPayloadCipher
{
    private const int KeySize = 32;
    private const int IvSize = 12;
    private const int TagSize = 16;
    private readonly byte[] _key;

    public CardPayloadCipher(IConfiguration configuration)
    {
        var value = configuration["CardPayloadEncryption:Key"]
            ?? throw new InvalidOperationException("CardPayloadEncryption:Key is required.");

        _key = DecodeKey(value);

        if (_key.Length != KeySize)
        {
            throw new InvalidOperationException("CardPayloadEncryption:Key must be Base64 for 32 bytes or 64 hexadecimal characters.");
        }
    }

    public EncryptedCardPayload Encrypt<T>(T value)
    {
        var plaintext = JsonSerializer.SerializeToUtf8Bytes(value, JsonDefaults.Options);
        var iv = RandomNumberGenerator.GetBytes(IvSize);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[TagSize];

        using var aes = new AesGcm(_key, TagSize);
        aes.Encrypt(iv, plaintext, ciphertext, tag);

        var encrypted = new byte[ciphertext.Length + tag.Length];
        Buffer.BlockCopy(ciphertext, 0, encrypted, 0, ciphertext.Length);
        Buffer.BlockCopy(tag, 0, encrypted, ciphertext.Length, tag.Length);
        return new EncryptedCardPayload(Convert.ToBase64String(iv), Convert.ToBase64String(encrypted));
    }

    private static byte[] DecodeKey(string value)
    {
        if (value.Length == KeySize * 2)
        {
            try
            {
                return Convert.FromHexString(value);
            }
            catch (FormatException)
            {
                // Not hex; it may still be a Base64 value.
            }
        }

        try
        {
            return Convert.FromBase64String(value);
        }
        catch (FormatException exception)
        {
            throw new InvalidOperationException("CardPayloadEncryption:Key must be Base64 or hexadecimal.", exception);
        }
    }
}

public sealed record EncryptedCardPayload(string Iv, string Ciphertext);
