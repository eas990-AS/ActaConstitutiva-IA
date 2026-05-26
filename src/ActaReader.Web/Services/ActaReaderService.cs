// src/ActaReader.Web/Services/ActaReaderService.cs
using ActaReader.Web.Models;

namespace ActaReader.Web.Services;

public class ActaReaderService
{
    private readonly IPdfExtractor      _pdfPig;
    private readonly IPdfExtractor      _tesseract;
    private readonly IFieldParser       _regexParser;
    private readonly IClaudeFieldParser _claudeParser;

    public ActaReaderService(
        IPdfExtractor pdfPig,
        IPdfExtractor tesseract,
        IFieldParser regexParser,
        IClaudeFieldParser claudeParser)
    {
        _pdfPig       = pdfPig;
        _tesseract    = tesseract;
        _regexParser  = regexParser;
        _claudeParser = claudeParser;
    }

    public async Task<IReadOnlyList<ActaField>> ExtractAsync(
        byte[] pdf, CancellationToken ct = default)
    {
        var extractor = _pdfPig.HasUsableText(pdf) ? _pdfPig : _tesseract;
        var pages     = await extractor.ExtractAsync(pdf);

        var regexFields  = _regexParser.Parse(pages);
        var missingKeys  = regexFields.Where(f => f.Source == "not_found").Select(f => f.Key).ToList();

        if (missingKeys.Count == 0) return regexFields;

        var claudeFields = await _claudeParser.ParseAsync(pages, missingKeys, ct);

        var allFields = regexFields
            .Where(f => f.Source != "not_found")
            .Concat(claudeFields)
            .OrderBy(f => RegexFieldParser.AllKeys.IndexOf(f.Key))
            .ToList();

        return allFields;
    }
}
