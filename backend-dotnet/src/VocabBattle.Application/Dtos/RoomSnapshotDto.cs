namespace VocabBattle.Application.Dtos;

public sealed record RoomSnapshotDto(
    string Code,
    string Status,
    string HostId,
    bool HasPassword,
    int PlayerCount,
    IReadOnlyList<PlayerDto> Players);
