namespace Tdn.Models.Schemas.Characters.Conversion;

using Tdn.Models.Schemas.Characters;

public static class CharacterResourcesConversion
{
    public static CharacterResourcesSchema AsModel(this CharacterResourcesPostData data)
    {
        return new CharacterResourcesSchema { Fields = data.Fields };
    }

    public static object ToResponse(this CharacterResourcesSchema schema) => new
    {
        type = schema.Type,
        fields = schema.Fields
    };
}
