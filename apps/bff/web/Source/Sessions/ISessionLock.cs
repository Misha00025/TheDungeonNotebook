namespace Tdn.Bff.Sessions;

public interface ISessionLock
{
    Task<ISessionLockLease> AcquireAsync(string key, CancellationToken cancellationToken);
}

public interface ISessionLockLease : IAsyncDisposable
{
    CancellationToken HandleLostToken { get; }
}
