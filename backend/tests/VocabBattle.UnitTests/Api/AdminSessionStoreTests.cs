using VocabBattle.Api.Security;
using Xunit;

namespace VocabBattle.UnitTests.Api;

public sealed class AdminSessionStoreTests
{
    [Fact]
    public void Issues_a_valid_token_only_after_the_configured_otp()
    {
        var sessions = new AdminSessionStore("031024");

        Assert.False(sessions.IsValidOtp("wrong"));
        Assert.True(sessions.IsValidOtp("031024"));
        Assert.True(sessions.IsValid(sessions.Create()));
    }
}
