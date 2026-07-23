using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;
using VocabBattle.Api.Serialization;
using Xunit;

namespace VocabBattle.UnitTests.Api;

public sealed class CardPayloadCipherTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void Encrypts_a_card_payload_with_aes_256_gcm(bool useHexKey)
    {
        var key = RandomNumberGenerator.GetBytes(32);
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["CardPayloadEncryption:Key"] = useHexKey ? Convert.ToHexString(key) : Convert.ToBase64String(key)
            })
            .Build();
        var encrypted = new CardPayloadCipher(configuration).Encrypt(new { Word = "apple" });
        var ciphertext = Convert.FromBase64String(encrypted.Ciphertext);
        var plaintext = new byte[ciphertext.Length - 16];

        using var aes = new AesGcm(key, 16);
        aes.Decrypt(
            Convert.FromBase64String(encrypted.Iv),
            ciphertext[..^16],
            ciphertext[^16..],
            plaintext);

        Assert.Contains("apple", Encoding.UTF8.GetString(plaintext));
    }
}
