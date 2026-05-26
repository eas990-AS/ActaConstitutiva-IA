// src/ActaReader.Web/Models/ActaField.cs
namespace ActaReader.Web.Models;

public record ActaField(
    string FieldName,   // Nombre legible: "Nombre de la sociedad"
    string Key,         // Clave interna:  "NombreSociedad"
    string Value,       // Valor extraído (vacío si no encontrado)
    int    PageNumber,  // Página (1-based); 0 = no encontrado
    string Source       // "regex" | "claude" | "not_found"
);
