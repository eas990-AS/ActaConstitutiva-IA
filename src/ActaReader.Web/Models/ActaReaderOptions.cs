// src/ActaReader.Web/Models/ActaReaderOptions.cs
namespace ActaReader.Web.Models;

public class ActaReaderOptions
{
    public int    MaxFileSizeMb { get; set; } = 50;
    public string ClaudeApiKey  { get; set; } = "";
    public string ClaudeModel   { get; set; } = "claude-sonnet-4-6";
    public string TessdataPath  { get; set; } = "./tessdata";
}
