// src/ActaReader.Web/Services/PdfPigExtractor.cs
using ActaReader.Web.Models;
using UglyToad.PdfPig;

namespace ActaReader.Web.Services;

public class PdfPigExtractor : IPdfExtractor
{
    private const int MinCharsPerPage = 20;

    public bool HasUsableText(byte[] pdf)
    {
        using var doc = PdfDocument.Open(pdf);
        if (doc.NumberOfPages == 0) return false;
        var total = doc.GetPages().Sum(p => p.Text.Length);
        return (total / doc.NumberOfPages) >= MinCharsPerPage;
    }

    public Task<IReadOnlyList<PageText>> ExtractAsync(byte[] pdf)
    {
        using var doc = PdfDocument.Open(pdf);
        IReadOnlyList<PageText> pages = doc.GetPages()
            .Select(p => new PageText(p.Number, p.Text))
            .ToList();
        return Task.FromResult(pages);
    }
}
