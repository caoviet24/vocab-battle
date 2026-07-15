using MediatR;
using VocabBattle.Application.Common.Mappings;
using VocabBattle.Application.Dtos;
using VocabBattle.Domain.Entities;
using VocabBattle.Domain.Repositories;

namespace VocabBattle.Application.Features.Categories.Commands;

public sealed record CreateCategoryCommand(CategoryInput Input) : IRequest<CategoryDto>;

public sealed class CreateCategoryCommandHandler(ICategoryRepository repository)
    : IRequestHandler<CreateCategoryCommand, CategoryDto>
{
    public async Task<CategoryDto> Handle(CreateCategoryCommand request, CancellationToken cancellationToken)
    {
        var category = new Category(string.Empty, request.Input.Name, request.Input.Description, DateTime.UtcNow);
        var saved = await repository.AddAsync(category, cancellationToken);
        return DomainMapper.ToDto(saved);
    }
}

public sealed record UpdateCategoryCommand(string Id, CategoryInput Input) : IRequest<CategoryDto?>;

public sealed class UpdateCategoryCommandHandler(ICategoryRepository repository)
    : IRequestHandler<UpdateCategoryCommand, CategoryDto?>
{
    public async Task<CategoryDto?> Handle(UpdateCategoryCommand request, CancellationToken cancellationToken)
    {
        var category = new Category(request.Id, request.Input.Name, request.Input.Description, DateTime.UtcNow);
        var updated = await repository.UpdateAsync(category, cancellationToken);
        return updated is null ? null : DomainMapper.ToDto(updated);
    }
}

public sealed record DeleteCategoryCommand(string Id) : IRequest<bool>;

public sealed class DeleteCategoryCommandHandler(ICategoryRepository repository)
    : IRequestHandler<DeleteCategoryCommand, bool>
{
    public Task<bool> Handle(DeleteCategoryCommand request, CancellationToken cancellationToken) =>
        repository.DeleteAsync(request.Id, cancellationToken);
}
