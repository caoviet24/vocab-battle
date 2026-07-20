using VocabBattle.Domain.Aggregates;
using VocabBattle.Domain.Entities;
using VocabBattle.Domain.Exceptions;
using VocabBattle.Domain.Results;
using VocabBattle.Domain.ValueObjects;
using Xunit;

namespace VocabBattle.UnitTests.Domain;

public sealed class GameRoomTests
{
    [Fact]
    public void CorrectAnswerScoresAndLocksQuestion()
    {
        var room = new GameRoom("ROOM-A");
        room.ConfigureHost("host", string.Empty);
        room.AddPlayer("host", "Host");
        room.AddPlayer("guest", "Guest");
        room.Start("host", [CreateCard("water")]);

        var winner = room.SubmitAnswer("guest", " Water ");
        var lateAnswer = room.SubmitAnswer("host", "water");

        Assert.Equal(AnswerOutcomeKind.Correct, winner.Kind);
        Assert.Equal(1, room.Players.Single(player => player.Id == "guest").Score);
        Assert.True(room.QuestionLocked);
        Assert.Equal(AnswerOutcomeKind.Ignored, lateAnswer.Kind);
    }

    [Fact]
    public void OnlyHostCanStartGame()
    {
        var room = new GameRoom("ROOM-A");
        room.ConfigureHost("host", string.Empty);
        room.AddPlayer("host", "Host");
        room.AddPlayer("guest", "Guest");

        var exception = Assert.Throws<GameRuleException>(() => room.Start("guest", [CreateCard("water")]));

        Assert.Equal("Chỉ chủ phòng mới có thể bắt đầu", exception.Message);
    }

    private static Card CreateCard(string word) => new(
        "card-1",
        word,
        "noun",
        new BilingualText("A clear liquid", "Chất lỏng trong suốt"),
        "nước",
        new BilingualText($"Drink {word}", $"Uống {word}"),
        [new Phonetic("/test/", "https://audio.test/file.mp3", "en")],
        string.Empty,
        "easy",
        "category-1");
}
