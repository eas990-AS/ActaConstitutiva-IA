// tests/ActaReader.Tests/RegexFieldParserTests.cs
using ActaReader.Web.Models;
using ActaReader.Web.Services;

namespace ActaReader.Tests;

public class RegexFieldParserTests
{
    private static readonly string Page1 = """
        ESCRITURA NUMERO 12,450
        En la ciudad de Monterrey, Estado de Nuevo Leon, a los 15 dias del mes de marzo del ano 2021,
        ante mi, Licenciado Juan Perez Garcia, Titular de la Notaria Publica Numero 45
        del Estado de Nuevo Leon.
        """;

    private static readonly string Page2 = """
        PRIMERA.- DENOMINACION SOCIAL: La sociedad se denominara
        TRANSPORTES RAPIDOS DEL NORTE, SOCIEDAD ANONIMA DE CAPITAL VARIABLE,
        o en su forma abreviada TRANSPORTES RAPIDOS DEL NORTE, S.A. de C.V.
        """;

    private static readonly string Page3 = """
        SEGUNDA.- OBJETO SOCIAL: La sociedad tendra por objeto la prestacion de servicios de
        transporte terrestre de carga y pasajeros en todo el territorio nacional.
        TERCERA.- DOMICILIO SOCIAL: El domicilio de la sociedad sera en Av. Constitucion 100,
        Col. Centro, Monterrey, Nuevo Leon, Mexico.
        CUARTA.- DURACION: La duracion de la sociedad sera de 99 anos contados a partir de la
        fecha de su constitucion.
        """;

    private static readonly string Page4 = """
        QUINTA.- CAPITAL SOCIAL: El capital social fijo es de $50,000.00 (Cincuenta mil pesos MXN),
        y el capital variable podra ser hasta de $500,000.00 (Quinientos mil pesos MXN).
        SOCIOS FUNDADORES: Pedro Ramirez Soto con el 60% y Ana Lopez Vega con el 40%.
        REPRESENTANTE LEGAL: Pedro Ramirez Soto, quien fungira como Administrador Unico.
        """;

    private IReadOnlyList<PageText> Pages() => new[]
    {
        new PageText(1, Page1),
        new PageText(2, Page2),
        new PageText(3, Page3),
        new PageText(4, Page4),
    };

    [Fact]
    public void Parse_NumeroEscritura_ExtractedWithCorrectPage()
    {
        var fields = new RegexFieldParser().Parse(Pages());
        var f = fields.First(x => x.Key == "NumeroEscritura");
        Assert.Contains("12,450", f.Value);
        Assert.Equal(1, f.PageNumber);
        Assert.Equal("regex", f.Source);
    }

    [Fact]
    public void Parse_NombreNotario_ExtractedWithCorrectPage()
    {
        var fields = new RegexFieldParser().Parse(Pages());
        var f = fields.First(x => x.Key == "NombreNotario");
        Assert.Contains("Juan Perez Garcia", f.Value);
        Assert.Equal(1, f.PageNumber);
    }

    [Fact]
    public void Parse_NombreSociedad_ExtractedWithCorrectPage()
    {
        var fields = new RegexFieldParser().Parse(Pages());
        var f = fields.First(x => x.Key == "NombreSociedad");
        Assert.Contains("TRANSPORTES RAPIDOS DEL NORTE", f.Value);
        Assert.Equal(2, f.PageNumber);
    }

    [Fact]
    public void Parse_TipoSociedad_ExtractedWithCorrectPage()
    {
        var fields = new RegexFieldParser().Parse(Pages());
        var f = fields.First(x => x.Key == "TipoSociedad");
        Assert.Contains("S.A. de C.V.", f.Value, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(2, f.PageNumber);
    }

    [Fact]
    public void Parse_CapitalFijo_ExtractedWithCorrectPage()
    {
        var fields = new RegexFieldParser().Parse(Pages());
        var f = fields.First(x => x.Key == "CapitalFijo");
        Assert.Contains("50,000", f.Value);
        Assert.Equal(4, f.PageNumber);
    }

    [Fact]
    public void Parse_Duracion_ExtractedWithCorrectPage()
    {
        var fields = new RegexFieldParser().Parse(Pages());
        var f = fields.First(x => x.Key == "Duracion");
        Assert.Contains("99", f.Value);
        Assert.Equal(3, f.PageNumber);
    }

    [Fact]
    public void Parse_EmptyText_AllFieldsNotFound()
    {
        var fields = new RegexFieldParser().Parse(new[] { new PageText(1, "texto sin datos") });
        Assert.All(fields, f => Assert.Equal("not_found", f.Source));
    }

    [Fact]
    public void Parse_Returns14Fields()
    {
        var fields = new RegexFieldParser().Parse(Pages());
        Assert.Equal(14, fields.Count);
    }
}
