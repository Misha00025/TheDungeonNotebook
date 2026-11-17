using System.Text.Json.Serialization;

namespace Tdn.Campaigns.Access;

public enum SubjectType
{
    User = 0,
    Group = 1,
    Admin = 2
}

public sealed record Subject([property: JsonRequired] SubjectType Type, [property: JsonRequired] int Id);
