// tests/ActaReader.Tests/PdfPigExtractorTests.cs
using ActaReader.Web.Models;
using ActaReader.Web.Services;
using UglyToad.PdfPig.Core;
using UglyToad.PdfPig.Content;
using UglyToad.PdfPig.Fonts.Standard14Fonts;
using UglyToad.PdfPig.Writer;

namespace ActaReader.Tests;

public class PdfPigExtractorTests
{
    private static byte[] BuildTestPdf(params string[] pageTexts)
    {
        var builder = new PdfDocumentBuilder();
        var font = builder.AddStandard14Font(Standard14Font.Helvetica);
        foreach (var text in pageTexts)
        {
            var page = builder.AddPage(PageSize.A4);
            page.AddText(text, 12, new PdfPoint(72, 700), font);
        }
        return builder.Build();
    }

    [Fact]
    public void HasUsableText_WhenPdfHasText_ReturnsTrue()
    {
        var bytes = BuildTestPdf("DENOMINACION SOCIAL: EMPRESA TEST S.A. DE C.V.");
        var extractor = new PdfPigExtractor();
        Assert.True(extractor.HasUsableText(bytes));
    }

    [Fact]
    public async Task ExtractAsync_SinglePage_ReturnsPageTextWithPageNumber1()
    {
        var bytes = BuildTestPdf("NOTARIO PUBLICO NUMERO 45 DE MONTERREY NUEVO LEON");
        var extractor = new PdfPigExtractor();
        var pages = await extractor.ExtractAsync(bytes);
        Assert.Single(pages);
        Assert.Equal(1, pages[0].PageNumber);
        Assert.Contains("NOTARIO", pages[0].Text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ExtractAsync_MultiplePages_ReturnsCorrectPageNumbers()
    {
        var bytes = BuildTestPdf("Pagina uno con texto de prueba", "Pagina dos con texto de prueba");
        var extractor = new PdfPigExtractor();
        var pages = await extractor.ExtractAsync(bytes);
        Assert.Equal(2, pages.Count);
        Assert.Equal(1, pages[0].PageNumber);
        Assert.Equal(2, pages[1].PageNumber);
    }

    [Fact]
    public void HasUsableText_WhenPdfHasNoText_ReturnsFalse()
    {
        var bytes = BuildTestPdf(""); // empty text = no usable content
        var extractor = new PdfPigExtractor();
        Assert.False(extractor.HasUsableText(bytes));
    }
}
