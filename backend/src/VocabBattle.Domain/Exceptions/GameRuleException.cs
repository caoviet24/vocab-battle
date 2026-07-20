namespace VocabBattle.Domain.Exceptions;

public sealed class GameRuleException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}
