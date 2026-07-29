using Tdn.Db.Contexts;
using Tdn.Models.Providing;

namespace Tdn.Api.Controllers;

public abstract class CharactersBaseController : GroupsBaseController
{
    protected CharactersBaseController(CampaignContext context, GroupAccessHelper accessHelper) : base(context, accessHelper)
    {
    }
}
