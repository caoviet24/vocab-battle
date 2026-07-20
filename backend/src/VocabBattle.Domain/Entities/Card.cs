using VocabBattle.Domain.ValueObjects;

namespace VocabBattle.Domain.Entities;

public sealed record Card(
    string Id,
    string Word,
    string Type,
    BilingualText Explanation,
    string Translation,
    BilingualText Example,
    IReadOnlyList<Phonetic> Phonetics,
    string ImageUrl,
    string Difficulty,
    string CategoryId);
