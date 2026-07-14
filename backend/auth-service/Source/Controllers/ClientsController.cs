using Microsoft.AspNetCore.Mvc;
using Tdn.Services;

namespace Tdn.Api.Controllers;

[Route("auth/clients")]
[ApiController]
public class ClientsController : ControllerBase
{
    private readonly ClientStore _clientStore;

    public ClientsController(ClientStore clientStore)
    {
        _clientStore = clientStore;
    }

    [HttpPost]
    public ActionResult RegisterClient([FromBody] ClientRegistrationRequest request)
    {
        _clientStore.Register(request.ClientId, request.ClientSecret, request.AllowedGroupIds);
        return Created("/auth/clients", new { clientId = request.ClientId });
    }
}

public struct ClientRegistrationRequest
{
    public string ClientId { get; set; }
    public string ClientSecret { get; set; }
    public List<int> AllowedGroupIds { get; set; }
}
