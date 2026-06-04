// src/ActaReader.Web/Services/ActaReaderService.cs
using ActaReader.Web.Models;
using Microsoft.Extensions.Logging;

namespace ActaReader.Web.Services;

public class ActaReaderService
{
    private readonly IPdfExtractor      _pdfPig;
    private readonly IPdfExtractor      _tesseract;
    private readonly IFieldParser       _regexParser;
    private readonly IClaudeFieldParser _claudeParser;
    private readonly ILogger<ActaReaderService> _log;

    public ActaReaderService(
        IPdfExtractor pdfPig,
        IPdfExtractor tesseract,
        IFieldParser regexParser,
        IClaudeFieldParser claudeParser,
        ILogger<ActaReaderService> log)
    {
        _pdfPig       = pdfPig;
        _tesseract    = tesseract;
        _regexParser  = regexParser;
        _claudeParser = claudeParser;
        _log          = log;
    }

    public async Task<IReadOnlyList<ActaField>> ExtractAsync(
        byte[] pdf, CancellationToken ct = default)
    {
        bool usePdfPig = _pdfPig.HasUsableText(pdf);
        var extractor  = usePdfPig ? _pdfPig : _tesseract;
        _log.LogInformation("=== EXTRACTOR: {e} ===", usePdfPig ? "PdfPig (texto nativo)" : "Tesseract (OCR)");

        var pages = await extractor.ExtractAsync(pdf);
        _log.LogInformation("Páginas extraídas: {n}, total chars: {c}",
            pages.Count, pages.Sum(p => p.Text.Length));

        foreach (var p in pages)
            _log.LogInformation("  Pág {n}: {c} chars — preview: {t}",
                p.PageNumber, p.Text.Length,
                p.Text.Length > 120 ? p.Text[..120].Replace('\n',' ') : p.Text.Replace('\n',' '));

        var regexFields = _regexParser.Parse(pages);
        _log.LogInformation("--- Regex ---");
        foreach (var f in regexFields)
            _log.LogInformation("  [{src}] {key}: {val}", f.Source, f.Key, f.Value);

        var missingKeys = regexFields.Where(f => f.Source == "not_found").Select(f => f.Key).ToList();
        if (missingKeys.Count == 0) return regexFields;

        _log.LogInformation("--- Claude (campos faltantes: {n}) ---", missingKeys.Count);
        var claudeFields = await _claudeParser.ParseAsync(pages, missingKeys, ct);
        foreach (var f in claudeFields)
            _log.LogInformation("  [{src}] {key}: {val}", f.Source, f.Key, f.Value);

        return regexFields
            .Where(f => f.Source != "not_found")
            .Concat(claudeFields)
            .OrderBy(f => ((IList<string>)RegexFieldParser.AllKeys).IndexOf(f.Key))
            .ToList();
    }
}
