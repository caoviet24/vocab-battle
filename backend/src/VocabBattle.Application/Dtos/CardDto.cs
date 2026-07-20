namespace VocabBattle.Application.Dtos;

public sealed record CardDto(
    string CardId,
    string Word,
    string Type,
    BilingualTextDto Explanation,
    string Translation,
    BilingualTextDto Example,
    IReadOnlyList<PhoneticDto> Phonetics,
    string ImageUrl,
    string Difficulty,
    string CategoryId);
