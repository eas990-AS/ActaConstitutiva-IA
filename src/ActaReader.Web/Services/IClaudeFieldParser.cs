// src/ActaReader.Web/Services/IClaudeFieldParser.cs
using ActaReader.Web.Models;

namespace ActaReader.Web.Services;

public interface IClaudeFieldParser
{
    Task<IReadOnlyList<ActaField>> ParseAsync(
        IReadOnlyList<PageText> pages,
        IEnumerable<string> missingKeys,
        CancellationToken ct = default);
}
