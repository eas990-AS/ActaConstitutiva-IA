// src/ActaReader.Web/Services/TesseractExtractor.cs
using ActaReader.Web.Models;
using Tesseract;
using UglyToad.PdfPig;

namespace ActaReader.Web.Services;

public class TesseractExtractor : IPdfExtractor
{
    private readonly string _tessdataPath;

    public TesseractExtractor(string tessdataPath) => _tessdataPath = tessdataPath;

    public bool HasUsableText(byte[] pdf) => false;

    public async Task<IReadOnlyList<PageText>> ExtractAsync(byte[] pdf)
    {
        if (pdf is null || pdf.Length == 0) return Array.Empty<PageText>();

        var results = new List<PageText>();

        await Task.Run(() =>
        {
            using var engine = new TesseractEngine(_tessdataPath, "spa", EngineMode.Default);
            using var doc = PdfDocument.Open(pdf);

            foreach (var pdfPage in doc.GetPages())
            {
                var text = OcrPage(engine, pdfPage);
                results.Add(new PageText(pdfPage.Number, text));
            }
        });

        return results;
    }

    private static string OcrPage(TesseractEngine engine, UglyToad.PdfPig.Content.Page pdfPage)
    {
        var images = pdfPage.GetImages().ToList();
        if (images.Count == 0) return string.Empty;

        var parts = new List<string>();
        foreach (var img in images)
        {
            if (!img.TryGetPng(out var pngBytes)) continue;
            using var pix = Pix.LoadFromMemory(pngBytes);
            using var tessPage = engine.Process(pix);
            parts.Add(tessPage.GetText());
        }
        return string.Join("\n", parts);
    }
}
