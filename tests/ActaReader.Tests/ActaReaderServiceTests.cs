// tests/ActaReader.Tests/ActaReaderServiceTests.cs
using ActaReader.Web.Models;
using ActaReader.Web.Services;
using Moq;
using UglyToad.PdfPig.Content;
using UglyToad.PdfPig.Core;
using UglyToad.PdfPig.Fonts.Standard14Fonts;
using UglyToad.PdfPig.Writer;

namespace ActaReader.Tests;

public class ActaReaderServiceTests
{
    private static byte[] MinimalPdf()
    {
        var b = new PdfDocumentBuilder();
        var f = b.AddStandard14Font(Standard14Font.Helvetica);
        var p = b.AddPage(PageSize.A4);
        p.AddText("Texto", 12, new PdfPoint(72, 700), f);
        return b.Build();
    }

    private static IReadOnlyList<PageText> OnePage() =>
        new[] { new PageText(1, "Texto de prueba") };

    private static List<ActaField> AllRegexFound() =>
        RegexFieldParser.AllKeys
            .Select(k => new ActaField(k, k, "valor", 1, "regex"))
            .ToList();

    private static List<ActaField> SomeNotFound(int count) =>
        RegexFieldParser.AllKeys.Select((k, i) =>
            i < count
                ? new ActaField(k, k, "valor", 1, "regex")
                : new ActaField(k, k, "", 0, "not_found")).ToList();

    [Fact]
    public async Task ExtractAsync_WhenAllRegexFound_NeverCallsClaude()
    {
        var pdf    = MinimalPdf();
        var pages  = OnePage();
        var fields = AllRegexFound();

        var pdfPig   = new Mock<IPdfExtractor>();
        pdfPig.Setup(e => e.HasUsableText(pdf)).Returns(true);
        pdfPig.Setup(e => e.ExtractAsync(pdf)).ReturnsAsync(pages);

        var regex  = new Mock<IFieldParser>();
        regex.Setup(p => p.Parse(pages)).Returns(fields);

        var claude = new Mock<IClaudeFieldParser>();

        var svc    = new ActaReaderService(pdfPig.Object, new Mock<IPdfExtractor>().Object, regex.Object, claude.Object);
        var result = await svc.ExtractAsync(pdf);

        Assert.Equal(14, result.Count);
        claude.Verify(c => c.ParseAsync(It.IsAny<IReadOnlyList<PageText>>(),
            It.IsAny<IEnumerable<string>>(), default), Times.Never);
    }

    [Fact]
    public async Task ExtractAsync_WhenSomeFieldsMissing_CallsClaude()
    {
        var pdf    = MinimalPdf();
        var pages  = OnePage();
        var partial = SomeNotFound(count: 5); // first 5 found, rest not_found
        var missing = partial.Where(f => f.Source == "not_found").Select(f => f.Key).ToList();
        var claudeResult = missing.Select(k => new ActaField(k, k, "IA val", 2, "claude")).ToList();

        var pdfPig = new Mock<IPdfExtractor>();
        pdfPig.Setup(e => e.HasUsableText(pdf)).Returns(true);
        pdfPig.Setup(e => e.ExtractAsync(pdf)).ReturnsAsync(pages);

        var regex  = new Mock<IFieldParser>();
        regex.Setup(p => p.Parse(pages)).Returns(partial);

        var claude = new Mock<IClaudeFieldParser>();
        claude.Setup(c => c.ParseAsync(pages, It.IsAny<IEnumerable<string>>(), default))
              .ReturnsAsync(claudeResult);

        var svc    = new ActaReaderService(pdfPig.Object, new Mock<IPdfExtractor>().Object, regex.Object, claude.Object);
        var result = await svc.ExtractAsync(pdf);

        claude.Verify(c => c.ParseAsync(It.IsAny<IReadOnlyList<PageText>>(),
            It.IsAny<IEnumerable<string>>(), default), Times.Once);
        Assert.Equal(14, result.Count);
    }

    [Fact]
    public async Task ExtractAsync_WhenNativeTextAbsent_UsesTesseract()
    {
        var pdf    = MinimalPdf();
        var pages  = OnePage();
        var fields = AllRegexFound();

        var pdfPig     = new Mock<IPdfExtractor>();
        pdfPig.Setup(e => e.HasUsableText(pdf)).Returns(false);

        var tesseract  = new Mock<IPdfExtractor>();
        tesseract.Setup(e => e.ExtractAsync(pdf)).ReturnsAsync(pages);

        var regex  = new Mock<IFieldParser>();
        regex.Setup(p => p.Parse(pages)).Returns(fields);

        var claude = new Mock<IClaudeFieldParser>();

        var svc = new ActaReaderService(pdfPig.Object, tesseract.Object, regex.Object, claude.Object);
        await svc.ExtractAsync(pdf);

        tesseract.Verify(e => e.ExtractAsync(pdf), Times.Once);
        pdfPig.Verify(e => e.ExtractAsync(pdf), Times.Never);
    }
}
