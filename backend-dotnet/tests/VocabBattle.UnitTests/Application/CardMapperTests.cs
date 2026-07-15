using VocabBattle.Application.Common.Mappings;
using VocabBattle.Domain.Entities;
using VocabBattle.Domain.ValueObjects;
using Xunit;

namespace VocabBattle.UnitTests.Application;

public sealed class CardMapperTests
{
    [Theory]
    [InlineData("cat", "_a_")]
    [InlineData("ice cream", "__e _r_a_")]
    [InlineData("a", "_")]
    public void QuestionHintRevealsPartOfWordAndPreservesSpaces(string word, string expected)
    {
        var question = CardMapper.ToQuestionDto(CreateCard(word), 1, 10);

        Assert.Equal(expected, question.HintPattern);
        Assert.Equal(word.EnumerateRunes().Count(), question.WordLength);
        Assert.DoesNotContain(word, question.Example.En, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void QuestionDoesNotExposePhoneticsOrAnswer()
    {
        var question = CardMapper.ToQuestionDto(CreateCard("water"), 1, 10);
        var properties = question.GetType().GetProperties().Select(property => property.Name).ToArray();

        Assert.DoesNotContain("Phonetics", properties);
        Assert.DoesNotContain("Word", properties);
        Assert.Equal("Drink *****", question.Example.En);
    }

    private static Card CreateCard(string word) => new(
        "card-1",
        word,
        "noun",
        new BilingualText($"Definition of {word}", "Giải nghĩa"),
        "bản dịch",
        new BilingualText($"Drink {word}", $"Dùng {word}"),
        [new Phonetic("/secret/", "https://audio.test/file.mp3", "en")],
        string.Empty,
        "easy",
        "category-1");
}
