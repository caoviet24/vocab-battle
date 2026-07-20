namespace VocabBattle.Application.Dtos;

public sealed record CategoryDto(
    string CategoryId,
    string Name,
    string Description,
    string ImageUrl,
    DateTime CreatedAt);
