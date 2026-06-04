// src/ActaReader.Web/Services/RegexFieldParser.cs
using System.Text.RegularExpressions;
using ActaReader.Web.Models;

namespace ActaReader.Web.Services;

public class RegexFieldParser : IFieldParser
{
    private static readonly (string Key, string FieldName, Regex Pattern)[] Patterns =
    [
        ("NombreSociedad", "Nombre de la sociedad",
            new Regex(
                // Alt 1: nombre entre comillas después del encabezado
                @"DENOMINACI[OÓ]N(?:\s+SOCIAL)?\s*[-:.—][-.]?\s*[^\n«“""]{0,120}?[«“""]([^""”»\n«]{3,100})[""»”]" +
                // Alt 2: nombre después de "denominará / denominación … es/será"
                @"|DENOMINACI[OÓ]N(?:\s+SOCIAL)?\s*[-:.—][-.]?\s*[^\n]{0,120}?(?:denominar[aá]|(?<![A-Za-z])es(?![A-Za-z]))\s+([A-ZÁÉÍÓÚÜÑA-Za-záéíóúüñ0-9][^,\n""”»]{2,80}?)(?=[,\n])" +
                // Alt 3: nombre directamente tras el separador (sin frase introductoria)
                @"|DENOMINACI[OÓ]N(?:\s+SOCIAL)?\s*[-:.—][-.]?\s*([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s0-9\-&]{2,80}?)(?=,\s*(?:S\.A\.|S\.R\.L\.|Sociedad|SOCIEDAD)\b)",
                RegexOptions.IgnoreCase | RegexOptions.Multiline)),

        ("TipoSociedad", "Tipo de sociedad",
            new Regex(
                @"\b(S\.A\.\s*de\s*C\.V\.|S\.A\.C\.V\.|S\.R\.L\.\s*de\s*C\.V\.|S\.A\.P\.I\.\s*de\s*C\.V\.|SOCIEDAD\s+AN[OÓ]NIMA\s+DE\s+CAPITAL\s+VARIABLE|SOCIEDAD\s+DE\s+RESPONSABILIDAD\s+LIMITADA)",
                RegexOptions.IgnoreCase)),

        ("FechaConstitucion", "Fecha de constitución",
            new Regex(
                @"(?:a\s+los\s+)?(\d{1,2})\s+(?:d[ií]as?\s+del\s+mes\s+de\s+|de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+(?:del?\s+a[ñn]o\s+|de[l]?\s+)?(\d{4})",
                RegexOptions.IgnoreCase)),

        ("LugarConstitucion", "Lugar de constitución",
            new Regex(
                @"(?:en\s+la\s+ciudad\s+de\s+|en\s+)([A-ZÁÉÍÓÚÜÑA-Za-z][a-záéíóúüñA-ZÁÉÍÓÚÜÑA-Za-z\s]+),\s*(?:Estado\s+de\s+)?([A-ZÁÉÍÓÚÜÑA-Za-z][a-záéíóúüñA-ZÁÉÍÓÚÜÑA-Za-z\s]+?)(?=[,.]|\s+a\s+los)",
                RegexOptions.IgnoreCase)),

        ("NombreNotario", "Nombre del notario",
            new Regex(
                @"ante\s+m[ií],?\s+(?:el\s+)?(?:Licenciado\s+|Lic\.\s+|Doctor\s+|Dr\.\s+)?([A-ZÁÉÍÓÚÜÑA-Za-z][a-záéíóúüñA-ZÁÉÍÓÚÜÑA-Za-z\s]{5,60}?),?\s+Titular",
                RegexOptions.IgnoreCase)),

        ("NumeroEscritura", "Número de escritura",
            new Regex(
                @"(?:ESCRITURA|INSTRUMENTO)\s+(?:P[ÚU]BLICA?\s+)?N[ÚU]MERO\s+([\d,\.]+)",
                RegexOptions.IgnoreCase)),

        ("NumeroNotaria", "Número de notaría",
            new Regex(
                @"Notar[ií]a\s+(?:P[uú]blica\s+)?(?:N[uú]mero\s+)?(\d+)",
                RegexOptions.IgnoreCase)),

        ("SociosFundadores", "Socios fundadores",
            new Regex(
                @"SOCIOS?\s+FUNDADORES?\s*:?\s*(.{10,400}?)(?=\n[A-Z]{3,}\.?-|\.\s*$|$)",
                RegexOptions.IgnoreCase | RegexOptions.Singleline)),

        ("ObjetoSocial", "Objeto social",
            new Regex(
                @"OBJETO\s+SOCIAL\s*:?\s*(?:La\s+sociedad\s+tendr[aá]\s+por\s+objeto\s+)?(.{20,500}?)(?=\n[A-Z]{3,}\.?-|\.\s*$)",
                RegexOptions.IgnoreCase | RegexOptions.Singleline)),

        ("CapitalFijo", "Capital social fijo",
            new Regex(
                @"capital\s+(?:social\s+)?fijo\s+(?:es\s+de\s+|ser[aá]\s+de\s+)?(\$[\d,\.]+(?:\s*\([^)]+\))?\s*(?:MXN|pesos|m\.n\.)?)",
                RegexOptions.IgnoreCase)),

        ("CapitalVariable", "Capital social variable",
            new Regex(
                @"capital\s+variable\s+(?:podr[aá]\s+ser\s+)?(?:hasta\s+de\s+)?(\$[\d,\.]+(?:\s*\([^)]+\))?\s*(?:MXN|pesos|m\.n\.)?)",
                RegexOptions.IgnoreCase)),

        ("Duracion", "Duración de la sociedad",
            new Regex(
                @"duraci[oó]n\s+(?:de\s+la\s+sociedad\s+)?(?:ser[aá]\s+de\s+)?(\d+\s+a[ñn]os?)",
                RegexOptions.IgnoreCase)),

        ("DomicilioFiscal", "Domicilio fiscal",
            new Regex(
                @"DOMICILIO\s+(?:SOCIAL|FISCAL)\s*:?\s*(?:El\s+domicilio\s+de\s+la\s+sociedad\s+ser[aá]\s+en\s+)?(.{10,250}?)(?=\n[A-Z]{3,}\.?-|\.\s)",
                RegexOptions.IgnoreCase | RegexOptions.Singleline)),

        ("RepresentanteLegal", "Representante legal",
            new Regex(
                @"(?:REPRESENTANTE\s+LEGAL|ADMINISTRADOR\s+[ÚU]NICO)\s*:?\s*([A-ZÁÉÍÓÚÜÑA-Za-z][a-záéíóúüñA-ZÁÉÍÓÚÜÑA-Za-z\s]{5,60}?)(?=[,.\n]|quien)",
                RegexOptions.IgnoreCase)),
    ];

    // Abbreviated-form-first pattern for TipoSociedad, used to prefer "S.A. de C.V." over the long form
    private static readonly Regex TipoSociedadAbbrev = new Regex(
        @"\b(S\.A\.\s*de\s*C\.V\.|S\.A\.C\.V\.|S\.R\.L\.\s*de\s*C\.V\.|S\.A\.P\.I\.\s*de\s*C\.V\.)",
        RegexOptions.IgnoreCase);

    // Minimum acceptable length for each field's extracted value.
    private static readonly Dictionary<string, int> MinLength = new()
    {
        ["NombreSociedad"]    = 4,
        ["TipoSociedad"]      = 4,
        ["FechaConstitucion"] = 8,
        ["LugarConstitucion"] = 4,
        ["NombreNotario"]     = 8,
        ["NumeroEscritura"]   = 1,
        ["NumeroNotaria"]     = 1,
        ["SociosFundadores"]  = 8,
        ["ObjetoSocial"]      = 20,
        ["CapitalFijo"]       = 3,
        ["CapitalVariable"]   = 3,
        ["Duracion"]          = 3,
        ["DomicilioFiscal"]   = 8,
        ["RepresentanteLegal"]= 6,
    };

    // First word(s) that indicate a garbage OCR capture
    private static readonly HashSet<string> GarbageLeadWords =
        new(StringComparer.OrdinalIgnoreCase) { "o", "y", "de", "la", "el", "los", "las", "un", "una", "su" };

    private static bool IsGarbage(string key, string value)
    {
        if (value.Length < (MinLength.TryGetValue(key, out var min) ? min : 1)) return true;
        if (value[0] is ',' or '.' or ')' or '(' or ':' or ';') return true;
        var first = value.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "";
        if (GarbageLeadWords.Contains(first)) return true;
        return false;
    }

    public static IReadOnlyList<string> AllKeys { get; } = Patterns.Select(t => t.Key).ToArray();

    public IReadOnlyList<ActaField> Parse(IReadOnlyList<PageText> pages)
    {
        var results = new List<ActaField>();

        foreach (var (key, fieldName, pattern) in Patterns)
        {
            ActaField? found = null;

            foreach (var page in pages)
            {
                Match match;

                // For TipoSociedad, prefer the abbreviated form (S.A. de C.V.) when present
                if (key == "TipoSociedad")
                {
                    var abbrevMatch = TipoSociedadAbbrev.Match(page.Text);
                    match = abbrevMatch.Success ? abbrevMatch : pattern.Match(page.Text);
                }
                else
                {
                    match = pattern.Match(page.Text);
                }

                if (!match.Success) continue;

                var value = (match.Groups.Count > 2
                    ? string.Join(" de ", Enumerable.Range(1, match.Groups.Count - 1)
                        .Where(i => match.Groups[i].Success)
                        .Select(i => match.Groups[i].Value.Trim()))
                    : match.Groups[1].Value.Trim()).Trim();

                if (string.IsNullOrWhiteSpace(value) || IsGarbage(key, value)) continue;

                found = new ActaField(fieldName, key, value, page.PageNumber, "regex");
                break;
            }

            results.Add(found ?? new ActaField(fieldName, key, "", 0, "not_found"));
        }

        return results;
    }
}
