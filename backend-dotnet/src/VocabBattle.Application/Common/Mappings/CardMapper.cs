using System.Text;
using VocabBattle.Application.Dtos;
using VocabBattle.Domain.Entities;

namespace VocabBattle.Application.Common.Mappings;

public static class CardMapper
{
    public static CardDto ToDto(Card card) => new(
        card.Id,
        card.Word,
        card.Type,
        new BilingualTextDto(card.Explanation.En, card.Explanation.Vi),
        card.Translation,
        new BilingualTextDto(card.Example.En, card.Example.Vi),
        card.Phonetics.Select(item => new PhoneticDto(item.Text, item.Audio, item.Locale)).ToArray(),
        card.ImageUrl,
        card.Difficulty,
        card.CategoryId);

    public static QuestionDto ToQuestionDto(Card card, int round, int totalRounds) => new(
        card.Id,
        card.Type,
        new BilingualTextDto(Mask(card.Explanation.En, card.Word), Mask(card.Explanation.Vi, card.Word)),
        card.Translation,
        new BilingualTextDto(Mask(card.Example.En, card.Word), Mask(card.Example.Vi, card.Word)),
        card.ImageUrl,
        card.Word.EnumerateRunes().Count(),
        GenerateHintPattern(card.Word),
        round,
        totalRounds);

    private static string Mask(string text, string word)
    {
        if (text.Length == 0 || word.Length == 0)
        {
            return text;
        }

        var mask = new string('*', word.EnumerateRunes().Count());
        return text.Replace(word, mask, StringComparison.OrdinalIgnoreCase);
    }

    internal static string GenerateHintPattern(string word)
    {
        var runes = word.EnumerateRunes().ToArray();
        var letterPositions = runes
            .Select((value, index) => (value, index))
            .Where(item => !Rune.IsWhiteSpace(item.value))
            .Select(item => item.index)
            .ToArray();
        var revealed = new HashSet<int>();
        var revealCount = Math.Min((letterPositions.Length + 2) / 3, letterPositions.Length - 1);

        for (var step = 1; step <= revealCount; step++)
        {
            revealed.Add(letterPositions[step * letterPositions.Length / (revealCount + 1)]);
        }

        var result = new StringBuilder();
        for (var index = 0; index < runes.Length; index++)
        {
            result.Append(Rune.IsWhiteSpace(runes[index]) || revealed.Contains(index) ? runes[index].ToString() : "_");
        }

        return result.ToString();
    }
}
