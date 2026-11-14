using System.Text.Json.Serialization;

namespace Tdn.Accounts.Contracts;
public sealed record ValidateResponse(bool Valid, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? AccountId = null, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Error = null, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? GroupId = null, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? AccessLevel = null);
