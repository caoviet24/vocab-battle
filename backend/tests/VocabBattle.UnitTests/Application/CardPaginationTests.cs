using VocabBattle.Application.Dtos;
using VocabBattle.Application.Features.Cards.Queries;
using Xunit;

namespace VocabBattle.UnitTests.Application;

public sealed class CardPaginationTests
{
    [Fact]
    public void QueryCalculatesPageOffset()
    {
        var query = new GetCardsQuery(null, null, 3, 20);

        Assert.Equal(40, query.Skip);
    }

    [Theory]
    [InlineData(0, 0)]
    [InlineData(1, 1)]
    [InlineData(21, 2)]
    public void ResultCalculatesTotalPages(long total, long expected)
    {
        var result = new PagedResult<object>([], total, 1, 20);

        Assert.Equal(expected, result.TotalPages);
    }
}
