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
    private readonly ILogger<ClaudeFieldParser> _log;

    public ClaudeFieldParser(HttpClient http, ActaReaderOptions options, ILogger<ClaudeFieldParser> log)
    {
        _http  = http;
        _model = options.ClaudeModel;
        _log   = log;
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
            Eres un extractor experto de actas constitutivas mexicanas.
            Extrae los campos indicados del texto y devuelve el número de página donde
            cada campo está DEFINIDO O ESTABLECIDO FORMALMENTE en el acta, no donde
            simplemente se menciona de paso.

            Reglas importantes para el número de página:
            - NombreSociedad: usa la página de la CLÁUSULA de DENOMINACIÓN
              (donde dice "La sociedad se denominará..." o "DENOMINACIÓN.-"),
              NO la carátula ni el índice notarial.
            - NombreNotario: página donde el notario se identifica en el cuerpo del acta.
            - NumeroEscritura / NumeroNotaria: página donde aparece el encabezado
              del instrumento notarial.
            - Todos los demás: la página de la cláusula que lo establece, no la carátula.

            Si el texto de una página es muy corto o parece una carátula/índice,
            busca en las páginas siguientes con texto sustancial.

            Si no encuentras un campo, usa null en "value".
            Responde ÚNICAMENTE con JSON válido, sin texto adicional ni bloques de código:
            {
              "fields": [
                { "key": "NombreSociedad", "value": "...", "page": 4 },
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
            _log.LogInformation("Claude request: model={m}, prompt_chars={c}, keys=[{k}]",
                _model, prompt.Length, string.Join(",", keys));
            var resp = await _http.SendAsync(req, ct);
            var rawJson = await resp.Content.ReadAsStringAsync(ct);
            if (!resp.IsSuccessStatusCode)
            {
                _log.LogError("Claude HTTP {status}: {body}", (int)resp.StatusCode, rawJson);
                return keys.Select(k => MakeNotFound(k)).ToList();
            }
            _log.LogInformation("Claude OK ({status}), response_chars={c}", (int)resp.StatusCode, rawJson.Length);
            return ParseResponse(rawJson, keys, _log);
        }
        catch (OperationCanceledException) { throw; }
        catch (Exception ex)
        {
            _log.LogError(ex, "Claude call failed");
            return keys.Select(k => MakeNotFound(k)).ToList();
        }
    }

    private static string ExtractJson(string text)
    {
        // Strip markdown code fences if present
        var start = text.IndexOf("```json", StringComparison.OrdinalIgnoreCase);
        if (start >= 0)
        {
            start = text.IndexOf('\n', start) + 1;
            var end = text.IndexOf("```", start, StringComparison.OrdinalIgnoreCase);
            if (end > start) return text[start..end].Trim();
        }
        // Fallback: find the first '{' and last '}'
        var first = text.IndexOf('{');
        var last  = text.LastIndexOf('}');
        return first >= 0 && last > first ? text[first..(last + 1)] : text;
    }

    private static IReadOnlyList<ActaField> ParseResponse(string json, List<string> requested, ILogger log)
    {
        try
        {
            var doc    = JsonDocument.Parse(json);
            var text   = doc.RootElement.GetProperty("content")[0].GetProperty("text").GetString() ?? "";
            log.LogInformation("Claude inner text (first 500): {t}", text.Length > 500 ? text[..500] : text);
            text       = ExtractJson(text);
            var inner  = JsonDocument.Parse(text);
            var fields = inner.RootElement.GetProperty("fields");

            return fields.EnumerateArray().Select(f =>
            {
                var key   = f.TryGetProperty("key",   out var k) ? k.GetString() ?? "" : "";
                var value = f.TryGetProperty("value", out var v) && v.ValueKind == JsonValueKind.String
                            ? v.GetString() ?? "" : "";
                var page  = 0;
                if (f.TryGetProperty("page", out var p))
                {
                    if      (p.ValueKind == JsonValueKind.Number) page = p.GetInt32();
                    else if (p.ValueKind == JsonValueKind.String)
                        int.TryParse(p.GetString(), out page);
                }
                var source = string.IsNullOrWhiteSpace(value) ? "not_found" : "claude";
                return new ActaField(Descriptions.GetValueOrDefault(key, key), key, value, page, source);
            }).ToList();
        }
        catch (Exception ex)
        {
            log.LogError(ex, "ParseResponse failed, json={j}", json.Length > 300 ? json[..300] : json);
            return requested.Select(k => MakeNotFound(k)).ToList();
        }
    }

    private static ActaField MakeNotFound(string key) =>
        new(Descriptions.GetValueOrDefault(key, key), key, "", 0, "not_found");
}
