using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace Tdn.Models.Processing;

public class FieldExtractor
{
    public List<(string Key, string Type)> ExtractFields(string line)
    {
        var fields = new List<(string Key, string Type)>();
        var matches = Regex.Matches(line, @":([^:]*):");

        foreach (Match match in matches)
        {
            if (!string.IsNullOrEmpty(match.Value))
            {
                string fieldName;
                var type = match.Value[0] == '!' ? "modifier" : "value";
                
                if (type == "modifier")
                    fieldName = match.Groups[1].Value.Substring(1);
                else
                    fieldName = match.Groups[1].Value;
                fields.Add((fieldName, type));
            }
        }
        
        return fields;
    }
}
