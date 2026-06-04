// src/ActaReader.Web/Services/PdfPigExtractor.cs
using ActaReader.Web.Models;
using UglyToad.PdfPig;

namespace ActaReader.Web.Services;

public class PdfPigExtractor : IPdfExtractor
{
    private const int MinCharsPerPage   = 20;
    private const double MinTextPageRatio = 0.25; // al menos 25 % de páginas deben tener texto

    public bool HasUsableText(byte[] pdf)
    {
        if (pdf is null || pdf.Length == 0) return false;
        using var doc = PdfDocument.Open(pdf);
        if (doc.NumberOfPages == 0) return false;
        var pages      = doc.GetPages().ToList();
        var pagesWithText = pages.Count(p => p.Text.Length >= MinCharsPerPage);
        return pagesWithText >= 1 && (double)pagesWithText / pages.Count >= MinTextPageRatio;
    }

    public Task<IReadOnlyList<PageText>> ExtractAsync(byte[] pdf)
    {
        if (pdf is null || pdf.Length == 0) return Task.FromResult<IReadOnlyList<PageText>>(Array.Empty<PageText>());
        using var doc = PdfDocument.Open(pdf);
        IReadOnlyList<PageText> pages = doc.GetPages()
            .Select(p => new PageText(p.Number, p.Text))
            .ToList();
        return Task.FromResult(pages);
    }
}
