using VocabBattle.Domain.Entities;

namespace VocabBattle.Domain.Results;

public enum AnswerOutcomeKind
{
    Ignored,
    Incorrect,
    Correct
}

public sealed record AnswerOutcome(AnswerOutcomeKind Kind, Card? Card, Player? Player)
{
    public static AnswerOutcome Ignored() => new(AnswerOutcomeKind.Ignored, null, null);
}
