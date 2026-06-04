// src/ActaReader.Web/Services/TesseractExtractor.cs
// Uses pdftoppm + tesseract CLI instead of the .NET wrapper,
// which fails to load libleptonica on Apple Silicon (ARM64).
using System.Diagnostics;
using ActaReader.Web.Models;

namespace ActaReader.Web.Services;

public class TesseractExtractor : IPdfExtractor
{
    private const string Pdftoppm  = "/opt/homebrew/bin/pdftoppm";
    private const string Tesseract = "/opt/homebrew/bin/tesseract";
    private const int    MaxParallel = 4;

    // TesseractExtractor never claims native text — it is only used as OCR fallback.
    public bool HasUsableText(byte[] pdf) => false;

    public async Task<IReadOnlyList<PageText>> ExtractAsync(byte[] pdf)
    {
        if (pdf is null || pdf.Length == 0) return Array.Empty<PageText>();

        var tmpDir = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName());
        Directory.CreateDirectory(tmpDir);
        try
        {
            // Write the PDF to a temp file
            var pdfPath = Path.Combine(tmpDir, "input.pdf");
            await File.WriteAllBytesAsync(pdfPath, pdf);

            // Convert every page to a PNG at 150 DPI
            var pagePrefix = Path.Combine(tmpDir, "pg");
            await RunAsync(Pdftoppm, ["-png", "-r", "150", pdfPath, pagePrefix]);

            // Collect images in page order (pdftoppm names them pg-01.png, pg-02.png …)
            var images = Directory.GetFiles(tmpDir, "pg-*.png")
                .OrderBy(f => f)
                .ToList();

            if (images.Count == 0) return Array.Empty<PageText>();

            // OCR pages in parallel (up to MaxParallel at once)
            var sem     = new SemaphoreSlim(MaxParallel);
            var results = new PageText[images.Count];

            await Task.WhenAll(images.Select(async (imgPath, idx) =>
            {
                await sem.WaitAsync();
                try
                {
                    var outBase = Path.Combine(tmpDir, $"out-{idx:D4}");
                    await RunAsync(Tesseract, [imgPath, outBase, "-l", "spa"]);
                    var txtFile = outBase + ".txt";
                    var text    = File.Exists(txtFile) ? await File.ReadAllTextAsync(txtFile) : "";
                    results[idx] = new PageText(idx + 1, text.Trim());
                }
                finally { sem.Release(); }
            }));

            return results;
        }
        finally
        {
            try { Directory.Delete(tmpDir, recursive: true); } catch { /* best-effort */ }
        }
    }

    private static async Task RunAsync(string exe, string[] args)
    {
        var psi = new ProcessStartInfo(exe)
        {
            RedirectStandardOutput = true,
            RedirectStandardError  = true,
            UseShellExecute        = false,
        };
        foreach (var a in args) psi.ArgumentList.Add(a);

        using var proc = Process.Start(psi)
            ?? throw new InvalidOperationException($"Failed to start {exe}");
        await proc.WaitForExitAsync();
    }
}
