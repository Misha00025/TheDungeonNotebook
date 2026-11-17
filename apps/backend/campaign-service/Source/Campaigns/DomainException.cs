namespace Tdn.Campaigns.Campaigns;

public sealed class DomainException : Exception
{
    public DomainException(int statusCode, string code, string message, int? resourceId = null, Guid? requestId = null)
        : base(message)
    {
        StatusCode = statusCode;
        Code = code;
        ResourceId = resourceId;
        RequestId = requestId;
    }

    public int StatusCode { get; }
    public string Code { get; }
    public int? ResourceId { get; }
    public Guid? RequestId { get; }
}
