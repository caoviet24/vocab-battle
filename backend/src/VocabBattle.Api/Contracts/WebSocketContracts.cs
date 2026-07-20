using System.Text.Json;

namespace VocabBattle.Api.Contracts;

public sealed record IncomingMessage(string Type, JsonElement Payload);
public sealed record OutgoingMessage(string Type, object Payload);
public sealed record StartGamePayload(string CategoryId, int TotalQuestions);
public sealed record AnswerPayload(string Answer);
public sealed record ErrorPayload(string Code, string Message);
