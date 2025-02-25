using Microsoft.AspNetCore.Mvc;
using Tdn.Models;
using Tdn.Models.Conversions;
using Tdn.Security;

namespace Tdn.Api.Controllers;

public class CharacterBaseController : BaseController<Character>
{
	protected int CharacterId => Container.ResourceInfo[Resource.Character].Id;
	protected override string GetUUID() => CharacterId.ToString();
}