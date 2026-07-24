using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;

namespace VocabBattle.Api.Security;

public sealed class AdminSessionStore(string otp)
{
    public const string HeaderName = "X-Admin-Token";
    private readonly ConcurrentDictionary<string, DateTimeOffset> sessions = new();

    public bool IsValidOtp(string? value)
    {
        if (value is null) return false;

        var expected = Encoding.UTF8.GetBytes(otp);
        var supplied = Encoding.UTF8.GetBytes(value);
        return expected.Length == supplied.Length && CryptographicOperations.FixedTimeEquals(expected, supplied);
    }

    public string Create()
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        sessions[token] = DateTimeOffset.UtcNow.AddHours(8);
        return token;
    }

    public bool IsValid(string? token)
    {
        if (token is null || !sessions.TryGetValue(token, out var expiresAt)) return false;
        if (expiresAt > DateTimeOffset.UtcNow) return true;

        sessions.TryRemove(token, out _);
        return false;
    }
}
