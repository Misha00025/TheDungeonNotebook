using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Tdn.Models.Db;

namespace Tdn.Security;

public class TokenAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
	private TokensContext _tokensContext;

	[Obsolete]
	public TokenAuthenticationHandler(
		IOptionsMonitor<AuthenticationSchemeOptions> options, 
		ILoggerFactory logger, 
		UrlEncoder encoder, 
		ISystemClock clock,
		[FromServices] TokensContext tokensContext
	) : base(options, logger, encoder, clock)
	{
		_tokensContext = tokensContext;
	}

	protected override Task<AuthenticateResult> HandleAuthenticateAsync()
	{
		if (TryGetIdAndRole(out var role, out var name))
		{
			var claims = new[] { new Claim(ClaimTypes.Name, name), new Claim(ClaimTypes.Role, role) };
			var identity = new ClaimsIdentity(claims, Scheme.Name);
			var principal = new ClaimsPrincipal(identity);
			var ticket = new AuthenticationTicket(principal, Scheme.Name);
			return Task.FromResult(AuthenticateResult.Success(ticket));
		}
		else 
			return Task.FromResult(AuthenticateResult.NoResult());
	}
	
	private bool TryGetIdAndRole(out string role, out string id)
	{
		role = Role.None;
		id = "";
		if (TryGet("token", out var token))
		{
			if (TryGetUser(token, out var userId))
			{
				role = Role.User;
				id = userId;
			}		
		}
		else if (TryGet("Service-token", out var serviceToken))
		{
			if (TryGetGroup(serviceToken, out var groupId))
			{
				role = Role.Group;
				id = groupId;
			}
		}
		else
			return false;
		return role != Role.None;
	}
	
	private bool TryGet(string field, out string value)
	{
		value = "";
		if (!Request.Headers.ContainsKey(field))
			return false;
		string? tmp = Request.Headers[field];
		if (tmp == null)
			return false;
		value = tmp;
		return true;		
	}
	
	private bool TryGetUser(string token, out string userId) 
	{
		var tmp = _tokensContext.GetUserId(token).ToString();
		userId = "";
		if (tmp != null)
		{
			userId = tmp;
			_tokensContext.UpdateUserToken(token, userId);
		}			
		return tmp != null;
	} 
	
	private bool TryGetGroup(string token, out string groupId)
	{
		var tmp = _tokensContext.GetGroupId(token).ToString();
		groupId = "";
		if (tmp != null)
			groupId = tmp;
		return tmp != null;
	}
}