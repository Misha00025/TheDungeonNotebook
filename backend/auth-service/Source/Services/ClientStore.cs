namespace Tdn.Services;

public class ClientStore
{
    private readonly Dictionary<string, StoredClient> _clients = new();

    public record StoredClient(string ClientId, string HashedSecret, List<int> AllowedGroupIds);

    public void Register(string clientId, string secret, List<int> groupIds)
    {
        _clients[clientId] = new StoredClient(clientId,
            BCrypt.Net.BCrypt.HashPassword(secret), groupIds);
    }

    public StoredClient? Validate(string clientId, string secret)
    {
        if (!_clients.TryGetValue(clientId, out var client)) return null;
        if (!BCrypt.Net.BCrypt.Verify(secret, client.HashedSecret)) return null;
        return client;
    }
}
