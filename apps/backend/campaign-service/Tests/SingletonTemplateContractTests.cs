using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Tdn.Campaigns.Computation;
using Tdn.Campaigns.Http;
using Tdn.Campaigns.Sheets;
using Tdn.Campaigns.Views;

namespace CampaignService.Tests;

public sealed class SingletonTemplateContractTests
{
    [Fact]
    public void LegacyTemplateSelectorsAreRejectedAndSelectorFreeRequestsDeserialize()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        options.Converters.Add(new JsonStringEnumConverter());
        var characterJson = "{\"requestId\":\"00000000-0000-0000-0000-000000000001\",\"name\":\"Character\",\"templateId\":\"00000000-0000-0000-0000-000000000002\"}";
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<CharacterCreateRequest>(characterJson, options));
        var character = JsonSerializer.Deserialize<CharacterCreateRequest>("{\"requestId\":\"00000000-0000-0000-0000-000000000001\",\"name\":\"Character\"}", options);
        Assert.Equal("Character", character!.Name);

        var widgetWithSelector = "{\"kind\":\"Base\",\"fieldId\":\"00000000-0000-0000-0000-000000000003\",\"templateId\":\"00000000-0000-0000-0000-000000000002\"}";
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<WidgetSource>(widgetWithSelector, options));
        var widget = JsonSerializer.Deserialize<WidgetSource>("{\"kind\":\"Base\",\"fieldId\":\"00000000-0000-0000-0000-000000000003\"}", options);
        Assert.Equal(FieldSourceKind.Base, widget!.Kind);
    }

    [Fact]
    public void SingletonDtosHaveNoTemplateSelectorOrResourceIdentifier()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var templateMetadata = JsonSerializer.SerializeToElement(new TemplateMetadataDto(7, "Template", 1), options);
        Assert.Equal(new[] { "campaignId", "metadataRevision", "name" }, templateMetadata.EnumerateObject().Select(x => x.Name).Order().ToArray());
        var templateContent = JsonSerializer.SerializeToElement(new TemplateContentEnvelope(7, 0, new TemplateContent("", [])), options);
        Assert.DoesNotContain(templateContent.EnumerateObject(), x => x.Name is "resourceId" or "id" or "key");
        var character = JsonSerializer.SerializeToElement(new CharacterMetadataDto(Guid.NewGuid(), 7, "Character", Importance.Background, 1), options);
        Assert.DoesNotContain(character.EnumerateObject(), x => x.Name is "templateId" or "template");
        var source = JsonSerializer.SerializeToElement(new WidgetSource(FieldSourceKind.Base, Guid.NewGuid()), options);
        Assert.DoesNotContain(source.EnumerateObject(), x => x.Name == "templateId");
    }

    [Fact]
    public void TemplateControllerExposesOnlySixSingletonGetAndPutActions()
    {
        var controller = typeof(TemplatesController);
        Assert.Equal("api/campaigns/{campaignId:int}/template", controller.GetCustomAttributes(typeof(RouteAttribute), false)
            .Cast<RouteAttribute>().Single().Template);
        var actions = controller.GetMethods(System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.DeclaredOnly);
        var routed = actions.Where(x => x.GetCustomAttributes(typeof(HttpMethodAttribute), false).Length > 0).ToArray();
        Assert.Equal(6, routed.Length);
        Assert.Equal(new[] { "GET", "GET", "GET", "PUT", "PUT", "PUT" }, routed
            .Select(x => x.GetCustomAttributes(typeof(HttpMethodAttribute), false).Cast<HttpMethodAttribute>().Single().HttpMethods.Single()).Order().ToArray());
        Assert.DoesNotContain(routed, x => x.GetParameters().Any(p => p.ParameterType == typeof(Guid)));
        Assert.Equal(new[] { "", "", "content", "content", "virtual-fields", "virtual-fields" }, routed
            .Select(x => x.GetCustomAttributes(typeof(HttpMethodAttribute), false).Cast<HttpMethodAttribute>().Single().Template ?? "").Order(StringComparer.Ordinal).ToArray());
    }
}
