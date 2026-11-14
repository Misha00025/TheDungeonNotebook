using Microsoft.AspNetCore.Authentication;

namespace Tdn.Bff.Sessions;

public sealed record SessionSnapshot(AuthenticationTicket Ticket, byte[] ProtectedPayload);
