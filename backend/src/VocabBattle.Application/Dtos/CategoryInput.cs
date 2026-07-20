namespace VocabBattle.Application.Dtos;

public sealed record CategoryInput(string Name, string Description, string? ImageUrl = null);
