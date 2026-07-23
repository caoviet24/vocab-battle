using MediatR;
using VocabBattle.Api.Infrastructures;
using VocabBattle.Application.Dtos;
using VocabBattle.Application.Features.Frames.Commands;
using VocabBattle.Application.Features.Frames.Queries;

namespace VocabBattle.Api.Endpoints;

public sealed class FramesEndpoints : EndpointGroupBase
{
    public override void Map(WebApplication app)
    {
        var group = app.MapGroup(this);
        group.MapGet(GetFrames);
        group.MapPost(CreateFrame);
        group.MapPut(UpdateFrame, "{id}");
        group.MapDelete(DeleteFrame, "{id}");
    }

    public async Task<IResult> GetFrames(ISender sender, CancellationToken cancellationToken) =>
        Results.Ok(await sender.Send(new GetFramesQuery(), cancellationToken));

    public async Task<IResult> CreateFrame(FrameInput input, ISender sender, CancellationToken cancellationToken)
    {
        if (!IsValid(input)) return Results.BadRequest(new { message = "Frame data is invalid" });
        return Results.Ok(await sender.Send(new CreateFrameCommand(input), cancellationToken));
    }

    public async Task<IResult> UpdateFrame(string id, FrameInput input, ISender sender, CancellationToken cancellationToken)
    {
        if (!IsValid(input)) return Results.BadRequest(new { message = "Frame data is invalid" });
        var result = await sender.Send(new UpdateFrameCommand(id, input), cancellationToken);
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    public async Task<IResult> DeleteFrame(string id, ISender sender, CancellationToken cancellationToken) =>
        await sender.Send(new DeleteFrameCommand(id), cancellationToken) ? Results.NoContent() : Results.NotFound();

    public static bool IsValid(FrameInput input) =>
        !string.IsNullOrWhiteSpace(input.Name) && input.Name.Trim().Length <= 100 &&
        Uri.TryCreate(input.Url, UriKind.Absolute, out var uri) &&
        uri.Scheme is "http" or "https" && uri.AbsolutePath.EndsWith(".webp", StringComparison.OrdinalIgnoreCase);
}
