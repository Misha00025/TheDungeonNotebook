namespace Tdn.Accounts.Persistence;

public sealed class Account
{
    public int Id { get; set; }
    public ICollection<ExternalIdentity> ExternalIdentities { get; set; } = new List<ExternalIdentity>();
}

public sealed class ExternalIdentity
{
    public long Id { get; set; }
    public int AccountId { get; set; }
    public string Issuer { get; set; } = "";
    public string Subject { get; set; } = "";
    public Account Account { get; set; } = null!;
}
