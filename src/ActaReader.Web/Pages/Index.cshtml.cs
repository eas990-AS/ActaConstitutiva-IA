// src/ActaReader.Web/Pages/Index.cshtml.cs
using ActaReader.Web.Models;
using ActaReader.Web.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace ActaReader.Web.Pages;

public class IndexModel : PageModel
{
    private readonly ActaReaderService _service;
    private readonly ActaReaderOptions _options;

    public IndexModel(ActaReaderService service, ActaReaderOptions options)
    {
        _service = service;
        _options = options;
    }

    public void OnGet() { }

    public async Task<IActionResult> OnPostAsync(IFormFile pdf, CancellationToken ct)
    {
        if (pdf is null || pdf.Length == 0)
            return BadRequest(new { error = "No se recibió ningún archivo." });

        if (!pdf.ContentType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase)
            && !pdf.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "El archivo debe ser un PDF." });

        if (pdf.Length > _options.MaxFileSizeMb * 1024L * 1024L)
            return BadRequest(new { error = $"El archivo supera el límite de {_options.MaxFileSizeMb} MB." });

        using var ms = new MemoryStream();
        await pdf.CopyToAsync(ms, ct);
        var bytes = ms.ToArray();

        if (bytes.Length < 4 || bytes[0] != 0x25 || bytes[1] != 0x50 || bytes[2] != 0x44 || bytes[3] != 0x46)
            return BadRequest(new { error = "El archivo no es un PDF válido." });

        IReadOnlyList<ActaField> fields;
        try
        {
            fields = await _service.ExtractAsync(bytes, ct);
        }
        catch (Exception ex) when (
            ex.Message.Contains("password",  StringComparison.OrdinalIgnoreCase) ||
            ex.Message.Contains("encrypted", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { error = "El PDF está protegido con contraseña, no se puede leer." });
        }

        return new JsonResult(fields);
    }
}
