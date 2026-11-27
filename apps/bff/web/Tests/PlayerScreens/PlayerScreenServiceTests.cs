using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Tdn.Bff.PlayerScreens;
using Tdn.Bff.Sessions;

namespace bff_web.Tests.PlayerScreens;

public sealed class PlayerScreenServiceTests
{
    private const int CampaignId = 42;
    private const string CharacterId = "11111111-1111-1111-1111-111111111111";
    private const string UnwritableCharacterId = "22222222-2222-2222-2222-222222222222";

    [Fact]
    public async Task PlayerOpeningWritableCharacterGetsAuthorizedScreenAndWritableOptions()
    {
        var gateway = new PlayerScreenGatewayHandler();
        var tokenService = new FakeSessionTokenService();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ReverseProxy:Clusters:gateway:Destinations:gateway:Address"] = "https://gateway.example/"
            })
            .Build();
        var service = new PlayerScreenService(new FakeHttpClientFactory(gateway), configuration, tokenService);
        using var requestServices = new ServiceCollection()
            .AddLogging()
            .AddOptions<JsonOptions>()
            .Services
            .BuildServiceProvider();
        var context = new DefaultHttpContext
        {
            RequestServices = requestServices,
            User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(BffAuthenticationDefaults.SessionClaim, "server-session")],
                "test"))
        };
        context.Response.Body = new MemoryStream();

        var result = await service.GetCharacterScreenAsync(context, CampaignId, CharacterId);
        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        Assert.StartsWith("application/json", context.Response.ContentType);
        context.Response.Body.Position = 0;
        using var document = await JsonDocument.ParseAsync(context.Response.Body);
        var root = document.RootElement;

        var character = root.GetProperty("character");
        Assert.Equal(CharacterId, character.GetProperty("id").GetString());
        Assert.Equal(CampaignId, character.GetProperty("campaignId").GetInt32());
        Assert.Equal("Ariadne", character.GetProperty("name").GetString());
        Assert.Equal("Key", character.GetProperty("importance").GetString());
        Assert.Equal(7, character.GetProperty("metadataRevision").GetInt32());

        var permissions = root.GetProperty("permissions");
        Assert.Equal(new[] { "canRead", "canWrite" }, permissions.EnumerateObject().Select(property => property.Name).Order().ToArray());
        Assert.True(permissions.GetProperty("canRead").GetBoolean());
        Assert.True(permissions.GetProperty("canWrite").GetBoolean());

        var computed = root.GetProperty("computedSheet");
        Assert.Equal(9, computed.GetProperty("contentRevision").GetInt32());
        Assert.Equal(3, computed.GetProperty("templateContentRevision").GetInt32());
        Assert.Equal("A measured scout", computed.GetProperty("description").GetString());
        Assert.Empty(computed.GetProperty("baseFields").EnumerateArray());
        Assert.Empty(computed.GetProperty("formulaContentRevisions").EnumerateArray());
        Assert.Empty(computed.GetProperty("virtualFields").EnumerateArray());
        var presentation = root.GetProperty("presentation");
        Assert.Equal("view-page", presentation.GetProperty("defaults").GetProperty("page_1").GetString());
        Assert.Equal("view-header", presentation.GetProperty("defaults").GetProperty("character_header").GetString());

        var resolved = root.GetProperty("resolvedPresentations");
        Assert.Equal(new[] { "character_header", "page_1" }, resolved.EnumerateObject().Select(property => property.Name).Order().ToArray());
        Assert.Equal("page_1", resolved.GetProperty("page_1").GetProperty("contextKey").GetString());
        Assert.Equal("view-page", resolved.GetProperty("page_1").GetProperty("viewMetadata").GetProperty("id").GetString());
        Assert.Equal("character_header", resolved.GetProperty("character_header").GetProperty("contextKey").GetString());
        Assert.Equal("view-header", resolved.GetProperty("character_header").GetProperty("viewMetadata").GetProperty("id").GetString());

        var available = root.GetProperty("availableCharacters");
        var writable = Assert.Single(available.EnumerateArray());
        Assert.Equal(CharacterId, writable.GetProperty("id").GetString());
        Assert.Equal(CampaignId, writable.GetProperty("campaignId").GetInt32());
        Assert.Equal("Ariadne", writable.GetProperty("name").GetString());
        Assert.Equal("Key", writable.GetProperty("importance").GetString());
        Assert.Equal(7, writable.GetProperty("metadataRevision").GetInt32());
        Assert.True(writable.GetProperty("canWrite").GetBoolean());
        Assert.Equal(new[] { "campaignId", "canWrite", "id", "importance", "metadataRevision", "name" },
            writable.EnumerateObject().Select(property => property.Name).Order().ToArray());
        Assert.DoesNotContain("canManageAccess", root.GetRawText());
        Assert.Equal("server-session", tokenService.SessionKey);
    }

    private sealed class FakeHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }

    private sealed class FakeSessionTokenService : ISessionTokenService
    {
        public string? SessionKey { get; private set; }

        public Task<string> GetAccessTokenAsync(string sessionKey, CancellationToken cancellationToken)
        {
            SessionKey = sessionKey;
            return Task.FromResult("server-access-token");
        }
    }

    private sealed class PlayerScreenGatewayHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var uri = request.RequestUri!;
            var path = uri.AbsolutePath;
            HttpResponseMessage response;
            if (path == $"/api/campaigns/{CampaignId}/characters")
                response = Json("""
                    [
                      {"id":"11111111-1111-1111-1111-111111111111","campaignId":42,"name":"Ariadne","importance":"Key","metadataRevision":7},
                      {"id":"22222222-2222-2222-2222-222222222222","campaignId":42,"name":"Orion","importance":"Secondary","metadataRevision":3}
                    ]
                    """);
            else if (path == $"/api/campaigns/{CampaignId}/characters/{CharacterId}/permissions")
                response = Json("""{"canRead":true,"canWrite":true,"canManageAccess":true}""");
            else if (path == $"/api/campaigns/{CampaignId}/characters/{UnwritableCharacterId}/permissions")
                response = Json("""{"canRead":true,"canWrite":false,"canManageAccess":false}""");
            else if (path == $"/api/campaigns/{CampaignId}/characters/{CharacterId}")
                response = Json("""{"id":"11111111-1111-1111-1111-111111111111","campaignId":42,"name":"Ariadne","importance":"Key","metadataRevision":7}""");
            else if (path == $"/api/campaigns/{CampaignId}/characters/{CharacterId}/computed-sheet")
                response = Json("""{"contentRevision":9,"templateContentRevision":3,"formulaContentRevisions":[],"description":"A measured scout","baseFields":[],"virtualFields":[]}""");
            else if (path == $"/api/campaigns/{CampaignId}/presentation")
                response = Json("""{"contentRevision":5,"defaults":{"page_1":"view-page","character_header":"view-header"},"contextParams":{}}""");
            else if (path == $"/api/campaigns/{CampaignId}/presentation/resolve")
                response = Resolve(uri.Query);
            else
                throw new InvalidOperationException($"Unexpected fake Gateway read: {request.Method} {uri}");
            return Task.FromResult(response);
        }

        private static HttpResponseMessage Resolve(string query)
        {
            var contextKey = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(query)["contextKey"].ToString();
            var viewId = contextKey == "character_header" ? "view-header" : "view-page";
            return Json($$$"""
                {
                  "contextKey":"{{{contextKey}}}",
                  "viewMetadata":{"id":"{{{viewId}}}","key":"{{{viewId}}}","campaignId":42,"name":"Resolved view","metadataRevision":2},
                  "viewContent":{"campaignId":42,"resourceId":"{{{viewId}}}","contentRevision":4,"data":{"roots":[]}},
                  "contextParams":null,
                  "contentRevision":4
                }
                """);
        }

        private static HttpResponseMessage Json(string body) => new(HttpStatusCode.OK)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
    }
}
