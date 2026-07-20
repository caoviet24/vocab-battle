using MediatR;
using VocabBattle.Application.Common.Mappings;
using VocabBattle.Application.Dtos;
using VocabBattle.Domain.Entities;
using VocabBattle.Domain.Repositories;
using VocabBattle.Domain.ValueObjects;

namespace VocabBattle.Application.Features.Cards.Commands;

public sealed record CreateCardCommand(CardInput Input) : IRequest<CardDto>;

public sealed class CreateCardCommandHandler(ICardRepository repository)
    : IRequestHandler<CreateCardCommand, CardDto>
{
    public async Task<CardDto> Handle(CreateCardCommand request, CancellationToken cancellationToken)
    {
        var saved = await repository.AddAsync(CardCommandMapper.ToDomain(string.Empty, request.Input), cancellationToken);
        return CardMapper.ToDto(saved);
    }
}

public sealed record UpdateCardCommand(string Id, CardInput Input) : IRequest<CardDto?>;

public sealed class UpdateCardCommandHandler(ICardRepository repository)
    : IRequestHandler<UpdateCardCommand, CardDto?>
{
    public async Task<CardDto?> Handle(UpdateCardCommand request, CancellationToken cancellationToken)
    {
        var updated = await repository.UpdateAsync(CardCommandMapper.ToDomain(request.Id, request.Input), cancellationToken);
        return updated is null ? null : CardMapper.ToDto(updated);
    }
}

public sealed record DeleteCardCommand(string Id) : IRequest<bool>;

public sealed class DeleteCardCommandHandler(ICardRepository repository)
    : IRequestHandler<DeleteCardCommand, bool>
{
    public Task<bool> Handle(DeleteCardCommand request, CancellationToken cancellationToken) =>
        repository.DeleteAsync(request.Id, cancellationToken);
}

internal static class CardCommandMapper
{
    public static Card ToDomain(string id, CardInput input) => new(
        id,
        input.Word,
        input.Type,
        new BilingualText(input.Explanation.En, input.Explanation.Vi),
        input.Translation,
        new BilingualText(input.Example.En, input.Example.Vi),
        input.Phonetics.Select(p => new Phonetic(p.Text, p.Audio, p.Locale)).ToArray(),
        input.ImageUrl,
        input.Difficulty,
        input.CategoryId);
}
