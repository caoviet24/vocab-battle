namespace VocabBattle.Domain.Entities;

public sealed class Player(string id, string name)
{
    public string Id { get; } = id;
    public string Name { get; } = name;
    public int Score { get; private set; }

    public void AddPoint() => Score++;
    public void ResetScore() => Score = 0;
}
