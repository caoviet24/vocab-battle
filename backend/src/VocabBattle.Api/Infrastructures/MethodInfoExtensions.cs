using System.Reflection;
using Ardalis.GuardClauses;

namespace VocabBattle.Api.Infrastructures;

public static class MethodInfoExtensions
{
    public static bool IsAnonymous(this MethodInfo method) =>
        method.Name.IndexOfAny(['<', '>']) >= 0;

    public static void AnonymousMethod(this IGuardClause guardClause, Delegate input)
    {
        if (input.Method.IsAnonymous())
        {
            throw new ArgumentException("The endpoint name must be specified when using anonymous handlers.");
        }
    }
}
