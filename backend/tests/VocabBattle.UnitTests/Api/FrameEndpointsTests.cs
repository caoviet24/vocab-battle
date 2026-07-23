using VocabBattle.Api.Endpoints;
using VocabBattle.Application.Dtos;
using Xunit;

namespace VocabBattle.UnitTests.Api;

public sealed class FrameEndpointsTests
{
    [Theory]
    [InlineData("https://cdn.example.com/frames/blue.webp", true)]
    [InlineData("https://cdn.example.com/frames/blue.png", false)]
    [InlineData("/uploads/frame/blue.webp", false)]
    public void Accepts_only_absolute_webp_urls(string url, bool expected) =>
        Assert.Equal(expected, FramesEndpoints.IsValid(new FrameInput("Blue frame", url)));
}
