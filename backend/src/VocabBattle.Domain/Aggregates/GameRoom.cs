using VocabBattle.Domain.Entities;
using VocabBattle.Domain.Enums;
using VocabBattle.Domain.Exceptions;
using VocabBattle.Domain.Results;

namespace VocabBattle.Domain.Aggregates;

public sealed class GameRoom(string code)
{
    private readonly Dictionary<string, Player> _players = new(StringComparer.Ordinal);
    private readonly HashSet<string> _readyPlayerIds = new(StringComparer.Ordinal);
    private IReadOnlyList<Card> _cards = [];

    public string Code { get; } = code;
    public string Password { get; private set; } = string.Empty;
    public string HostId { get; private set; } = string.Empty;
    public GameStatus Status { get; private set; } = GameStatus.Lobby;
    public int CurrentQuestionIndex { get; private set; }
    public bool QuestionLocked { get; private set; }
    public int TotalRounds => _cards.Count;
    public IReadOnlyCollection<Player> Players => _players.Values;
    public IReadOnlyCollection<string> ReadyPlayerIds => _readyPlayerIds;
    public Card? CurrentCard => CurrentQuestionIndex < _cards.Count ? _cards[CurrentQuestionIndex] : null;

    public void ConfigureHost(string hostId, string password)
    {
        if (HostId.Length > 0 && !string.Equals(HostId, hostId, StringComparison.Ordinal))
        {
            throw new GameRuleException("HOST_CONFLICT", "Phòng đã có chủ phòng");
        }

        HostId = hostId;
        Password = password;
    }

    public bool VerifyPassword(string submitted) => Password.Length == 0 || Password == submitted;

    public bool AddPlayer(string playerId, string name, string frameUrl = "")
    {
        if (_players.ContainsKey(playerId))
        {
            return false;
        }

        _players[playerId] = new Player(playerId, name, frameUrl);
        return true;
    }

    public void RemovePlayer(string playerId)
    {
        _players.Remove(playerId);
        _readyPlayerIds.Remove(playerId);
    }

    public void Start(string playerId, IReadOnlyList<Card> cards)
    {
        if (playerId != HostId)
        {
            throw new GameRuleException("START_DENIED", "Chỉ chủ phòng mới có thể bắt đầu");
        }

        if (_players.Count < 2)
        {
            throw new GameRuleException("START_DENIED", "Cần ít nhất 2 người chơi để bắt đầu");
        }

        if (Status == GameStatus.Finished && _players.Keys.Any(id => !_readyPlayerIds.Contains(id)))
        {
            throw new GameRuleException("START_DENIED", "Chưa có tất cả người chơi sẵn sàng");
        }

        if (cards.Count == 0)
        {
            throw new GameRuleException("NO_QUESTIONS", "Không lấy được câu hỏi");
        }

        foreach (var player in _players.Values)
        {
            player.ResetScore();
        }

        _cards = cards;
        _readyPlayerIds.Clear();
        CurrentQuestionIndex = 0;
        QuestionLocked = false;
        Status = GameStatus.Playing;
    }

    public void UnlockCurrentQuestion() => QuestionLocked = false;

    public AnswerOutcome SubmitAnswer(string playerId, string answer)
    {
        if (Status != GameStatus.Playing || QuestionLocked || CurrentCard is not { } card ||
            !_players.TryGetValue(playerId, out var player))
        {
            return AnswerOutcome.Ignored();
        }

        if (!string.Equals(card.Word.Trim(), answer.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return new AnswerOutcome(AnswerOutcomeKind.Incorrect, card, player);
        }

        QuestionLocked = true;
        player.AddPoint();
        CurrentQuestionIndex++;
        return new AnswerOutcome(AnswerOutcomeKind.Correct, card, player);
    }

    public Card? Timeout(string playerId)
    {
        if (playerId != HostId || Status != GameStatus.Playing || QuestionLocked || CurrentCard is not { } card)
        {
            return null;
        }

        QuestionLocked = true;
        CurrentQuestionIndex++;
        return card;
    }

    public void MarkReady(string playerId)
    {
        if (_players.ContainsKey(playerId))
        {
            _readyPlayerIds.Add(playerId);
        }
    }

    public void Finish()
    {
        Status = GameStatus.Finished;
        QuestionLocked = true;
    }

    public void ReturnToLobby()
    {
        Status = GameStatus.Lobby;
        _cards = [];
        CurrentQuestionIndex = 0;
        QuestionLocked = false;
    }
}
