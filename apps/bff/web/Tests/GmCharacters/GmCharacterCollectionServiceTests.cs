using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Tdn.Bff.GmCharacters;
using Tdn.Bff.Sessions;

namespace bff_web.Tests.GmCharacters;

public sealed class GmCharacterCollectionServiceTests
{
    private const int CampaignId = 42;
    private const string WritableCharacterId = "11111111-1111-1111-1111-111111111111";
    private const string ReadOnlyCharacterId = "22222222-2222-2222-2222-222222222222";

    [Fact]
    public async Task GmCollectionWithPlayerFiltersReturnsOnlyMatchingCharactersAndRequestedAssignments()
    {
        var service = new GmCharacterCollectionService(
            new FakeHttpClientFactory(new CharacterCollectionGatewayHandler()),
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ReverseProxy:Clusters:gateway:Destinations:gateway:Address"] = "https://gateway.example/"
                })
                .Build(),
            new FakeSessionTokenService());
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
        context.Request.QueryString = new QueryString("?hasPlayers=true&playerAccess=write&include=assignments");
        context.Response.Body = new MemoryStream();

        var result = await service.ListAsync(context, CampaignId);
        await result.ExecuteAsync(context);

        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
        Assert.Equal("no-store", context.Response.Headers.CacheControl);
        context.Response.Body.Position = 0;
        using var document = await JsonDocument.ParseAsync(context.Response.Body);
        var root = document.RootElement;
        var character = Assert.Single(root.GetProperty("characters").EnumerateArray());
        Assert.Equal(WritableCharacterId, character.GetProperty("id").GetString());
        Assert.Equal(CampaignId, character.GetProperty("campaignId").GetInt32());
        Assert.Equal("Ariadne", character.GetProperty("name").GetString());
        Assert.Equal("Key", character.GetProperty("importance").GetString());
        Assert.Equal(7, character.GetProperty("metadataRevision").GetInt32());
        Assert.Equal(
            new[] { "assignedPlayers", "campaignId", "id", "importance", "metadataRevision", "name" },
            character.EnumerateObject().Select(property => property.Name).Order().ToArray());

        var assignedPlayers = character.GetProperty("assignedPlayers").EnumerateArray().ToArray();
        Assert.Equal(2, assignedPlayers.Length);
        Assert.Collection(
            assignedPlayers,
            player =>
            {
                Assert.Equal(101, player.GetProperty("userId").GetInt32());
                Assert.Equal("Ariadne's player", player.GetProperty("displayName").GetString());
                Assert.True(player.GetProperty("canWrite").GetBoolean());
                Assert.Equal(new[] { "canWrite", "displayName", "userId" }, player.EnumerateObject().Select(property => property.Name).Order().ToArray());
            },
            player =>
            {
                Assert.Equal(102, player.GetProperty("userId").GetInt32());
                Assert.Equal("readonly-player", player.GetProperty("displayName").GetString());
                Assert.False(player.GetProperty("canWrite").GetBoolean());
                Assert.Equal(new[] { "canWrite", "displayName", "userId" }, player.EnumerateObject().Select(property => property.Name).Order().ToArray());
            });
    }

    private sealed class FakeHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false);
    }

    private sealed class FakeSessionTokenService : ISessionTokenService
    {
        public Task<string> GetAccessTokenAsync(string sessionKey, CancellationToken cancellationToken) =>
            Task.FromResult("server-access-token");
    }

    private sealed class CharacterCollectionGatewayHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var path = request.RequestUri!.AbsolutePath;
            var body = path switch
            {
                "/api/campaigns/42/characters" => """
                    [
                      {"id":"11111111-1111-1111-1111-111111111111","campaignId":42,"name":"Ariadne","importance":"Key","metadataRevision":7},
                      {"id":"22222222-2222-2222-2222-222222222222","campaignId":42,"name":"Orion","importance":"Secondary","metadataRevision":3}
                    ]
                    """,
                "/api/campaigns/42/characters/11111111-1111-1111-1111-111111111111/assignments" => """
                    [
                      {"campaignId":42,"characterId":"11111111-1111-1111-1111-111111111111","userId":101,"canWrite":true,"metadataRevision":1},
                      {"campaignId":42,"characterId":"11111111-1111-1111-1111-111111111111","userId":102,"canWrite":false,"metadataRevision":2}
                    ]
                    """,
                "/api/campaigns/42/characters/22222222-2222-2222-2222-222222222222/assignments" => """
                    [{"campaignId":42,"characterId":"22222222-2222-2222-2222-222222222222","userId":103,"canWrite":false,"metadataRevision":1}]
                    """,
                "/users/101" => """{"id":101,"visibleName":"Ariadne's player","nickname":"ariadne-player","imageLink":"secret-profile-field"}""",
                "/users/102" => """{"id":102,"visibleName":" ","nickname":"readonly-player","imageLink":"secret-profile-field"}""",
                _ => throw new InvalidOperationException($"Unexpected fake Gateway read: {request.Method} {request.RequestUri}")
            };
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            });
        }
    }
}
