namespace VocabBattle.Domain.Entities;

public sealed record Category(
    string Id,
    string Name,
    string Description,
    string ImageUrl,
    DateTime CreatedAt);
