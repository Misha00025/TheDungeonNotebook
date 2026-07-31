using Microsoft.Extensions.Logging.Abstractions;
using Tdn.Db.Contexts;
using Tdn.Models.Access;
using Tdn.Models.Providing;

namespace Tdn.Tests.Fixtures;

public static class TestSubjectAccessHelperFactory
{
    public static SubjectAccessHelper Create(CampaignContext ctx, Subject? subject = null)
    {
        var accessHelper = new GroupAccessHelper(ctx);
        var httpContextAccessor = new TestHttpContextAccessor(subject);
        var logger = NullLogger<SubjectAccessHelper>.Instance;
        return new SubjectAccessHelper(accessHelper, httpContextAccessor, logger);
    }
}
