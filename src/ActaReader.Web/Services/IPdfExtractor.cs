// src/ActaReader.Web/Services/IPdfExtractor.cs
using ActaReader.Web.Models;

namespace ActaReader.Web.Services;

public interface IPdfExtractor
{
    bool HasUsableText(byte[] pdf);
    Task<IReadOnlyList<PageText>> ExtractAsync(byte[] pdf);
}
