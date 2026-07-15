namespace VocabBattle.Application.Dtos;

public sealed record QuestionDto(
    string CardId,
    string Type,
    BilingualTextDto Explanation,
    string Translation,
    BilingualTextDto Example,
    string ImageUrl,
    int WordLength,
    string HintPattern,
    int Round,
    int TotalRounds);
