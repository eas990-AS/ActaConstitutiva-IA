// src/ActaReader.Web/Services/IFieldParser.cs
using ActaReader.Web.Models;

namespace ActaReader.Web.Services;

public interface IFieldParser
{
    IReadOnlyList<ActaField> Parse(IReadOnlyList<PageText> pages);
}
