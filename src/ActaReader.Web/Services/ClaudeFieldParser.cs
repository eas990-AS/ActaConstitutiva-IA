// src/ActaReader.Web/Services/ClaudeFieldParser.cs
using System.Net.Http.Json;
using System.Text.Json;
using ActaReader.Web.Models;

namespace ActaReader.Web.Services;

public class ClaudeFieldParser : IClaudeFieldParser
{
    private static readonly Dictionary<string, string> Descriptions = new()
    {
        ["NombreSociedad"]     = "Nombre o denominación social de la empresa",
        ["TipoSociedad"]       = "Tipo de sociedad (S.A. de C.V., S.R.L., etc.)",
        ["FechaConstitucion"]  = "Fecha de constitución de la sociedad",
        ["LugarConstitucion"]  = "Ciudad y estado donde se constituyó",
        ["NombreNotario"]      = "Nombre completo del notario público",
        ["NumeroEscritura"]    = "Número de la escritura pública",
        ["NumeroNotaria"]      = "Número de la notaría pública",
        ["SociosFundadores"]   = "Nombres de socios fundadores y sus porcentajes de participación",
        ["ObjetoSocial"]       = "Objeto social de la empresa",
        ["CapitalFijo"]        = "Monto del capital social fijo",
        ["CapitalVariable"]    = "Monto máximo del capital social variable",
        ["Duracion"]           = "Duración de la sociedad en años",
        ["DomicilioFiscal"]    = "Domicilio social o fiscal de la empresa",
        ["RepresentanteLegal"] = "Nombre del representante legal o administrador único",
    };

    private readonly HttpClient _http;
    private readonly string _model;

    public ClaudeFieldParser(HttpClient http, ActaReaderOptions options)
    {
        _http  = http;
        _model = options.ClaudeModel;
    }

    public async Task<IReadOnlyList<ActaField>> ParseAsync(
        IReadOnlyList<PageText> pages,
        IEnumerable<string> missingKeys,
        CancellationToken ct = default)
    {
        var keys = missingKeys.Where(Descriptions.ContainsKey).ToList();
        if (keys.Count == 0) return [];

        var fieldList = keys.Select(k => $"- {k}: {Descriptions[k]}");
        var fullText  = string.Join("\n\n",
            pages.Select(p => $"--- PÁGINA {p.PageNumber} ---\n{p.Text}"));

        var prompt = $$"""
            Eres un extractor de datos de actas constitutivas mexicanas.
            Del siguiente texto extrae exactamente los campos listados.
            Para cada campo indica el número de página donde lo encontraste.
            Si no encuentras un campo, usa null en "value".
            Responde ÚNICAMENTE con JSON válido, sin texto adicional:
            {
              "fields": [
                { "key": "NombreSociedad", "value": "...", "page": 2 },
                ...
              ]
            }

            Campos a extraer:
            {{string.Join("\n", fieldList)}}

            Texto del acta:
            {{fullText}}
            """;

        var body = new
        {
            model      = _model,
            max_tokens = 2048,
            messages   = new[] { new { role = "user", content = prompt } }
        };

        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Post, "v1/messages")
            {
                Content = JsonContent.Create(body)
            };
            var resp = await _http.SendAsync(req, ct);
            resp.EnsureSuccessStatusCode();
            var json = await resp.Content.ReadAsStringAsync(ct);
            return ParseResponse(json, keys);
        }
        catch (OperationCanceledException) { throw; }
        catch
        {
            return keys.Select(k => MakeNotFound(k)).ToList();
        }
    }

    private static IReadOnlyList<ActaField> ParseResponse(string json, List<string> requested)
    {
        try
        {
            var doc     = JsonDocument.Parse(json);
            var text    = doc.RootElement.GetProperty("content")[0].GetProperty("text").GetString() ?? "";
            var inner   = JsonDocument.Parse(text);
            var fields  = inner.RootElement.GetProperty("fields");

            return fields.EnumerateArray().Select(f =>
            {
                var key    = f.GetProperty("key").GetString() ?? "";
                var value  = f.TryGetProperty("value", out var v) && v.ValueKind != JsonValueKind.Null
                             ? v.GetString() ?? "" : "";
                var page   = f.TryGetProperty("page", out var p) ? p.GetInt32() : 0;
                var source = string.IsNullOrWhiteSpace(value) ? "not_found" : "claude";
                return new ActaField(Descriptions.GetValueOrDefault(key, key), key, value, page, source);
            }).ToList();
        }
        catch
        {
            return requested.Select(k => MakeNotFound(k)).ToList();
        }
    }

    private static ActaField MakeNotFound(string key) =>
        new(Descriptions.GetValueOrDefault(key, key), key, "", 0, "not_found");
}
