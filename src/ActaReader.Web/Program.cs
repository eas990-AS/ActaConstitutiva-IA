// src/ActaReader.Web/Program.cs
using ActaReader.Web.Models;
using ActaReader.Web.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddRazorPages();

var opts = builder.Configuration.GetSection("ActaReader").Get<ActaReaderOptions>()
           ?? new ActaReaderOptions();
builder.Services.AddSingleton(opts);

builder.Services.AddSingleton<IPdfExtractor, PdfPigExtractor>();
builder.Services.AddSingleton<TesseractExtractor>(_ => new TesseractExtractor(opts.TessdataPath));
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
    sp.GetRequiredService<IClaudeFieldParser>()));

builder.WebHost.ConfigureKestrel(k =>
    k.Limits.MaxRequestBodySize = opts.MaxFileSizeMb * 1024L * 1024L);

var app = builder.Build();
if (!app.Environment.IsDevelopment()) app.UseExceptionHandler("/Error");
app.UseStaticFiles();
app.UseRouting();
app.MapRazorPages();
app.Run();
