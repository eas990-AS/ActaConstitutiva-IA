// src/ActaReader.Web/Program.cs
using ActaReader.Web.Models;
using ActaReader.Web.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddRazorPages();

var opts = builder.Configuration.GetSection("ActaReader").Get<ActaReaderOptions>()
           ?? new ActaReaderOptions();
builder.Services.AddSingleton(opts);

builder.Services.AddSingleton<IPdfExtractor, PdfPigExtractor>();
builder.Services.AddSingleton<TesseractExtractor>();
builder.Services.AddSingleton<IFieldParser, RegexFieldParser>();

builder.Services.AddHttpClient<IClaudeFieldParser, ClaudeFieldParser>(client =>
{
    client.BaseAddress = new Uri("https://api.anthropic.com/");
    client.DefaultRequestHeaders.Add("x-api-key", opts.ClaudeApiKey);
    client.DefaultRequestHeaders.Add("anthropic-version", "2023-06-01");
});

builder.Services.AddScoped<ActaReaderService>(sp => new ActaReaderService(
    sp.GetRequiredService<IPdfExtractor>(),
    sp.GetRequiredService<TesseractExtractor>(),
    sp.GetRequiredService<IFieldParser>(),
    sp.GetRequiredService<IClaudeFieldParser>(),
    sp.GetRequiredService<ILogger<ActaReaderService>>()));

builder.WebHost.ConfigureKestrel(k =>
    k.Limits.MaxRequestBodySize = opts.MaxFileSizeMb * 1024L * 1024L);

var app = builder.Build();
if (!app.Environment.IsDevelopment()) app.UseExceptionHandler("/Error");
app.UseStaticFiles();
app.UseRouting();
app.MapRazorPages();

// Endpoint de diagnóstico — solo en Development
if (app.Environment.IsDevelopment())
{
    app.MapPost("/debug-text", async (HttpRequest req, IPdfExtractor extractor) =>
    {
        if (!req.HasFormContentType) return Results.BadRequest("Enviar multipart/form-data con campo 'pdf'.");
        var form = await req.ReadFormAsync();
        var file = form.Files["pdf"];
        if (file is null) return Results.BadRequest("Campo 'pdf' requerido.");
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        var bytes = ms.ToArray();
        var pages = await extractor.ExtractAsync(bytes);
        var result = pages.Select(p => new
        {
            page    = p.PageNumber,
            chars   = p.Text.Length,
            preview = p.Text.Length > 600 ? p.Text[..600] + "…" : p.Text
        });
        return Results.Json(result);
    });
}

app.Run();
