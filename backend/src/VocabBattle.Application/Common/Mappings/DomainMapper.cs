using VocabBattle.Application.Dtos;
using VocabBattle.Domain.Entities;

namespace VocabBattle.Application.Common.Mappings;

public static class DomainMapper
{
    public static PlayerDto ToDto(Player player) => new(player.Id, player.Name, player.Score);
    public static CategoryDto ToDto(Category category) =>
        new(category.Id, category.Name, category.Description, category.ImageUrl, category.CreatedAt);
}
