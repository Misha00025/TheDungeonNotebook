using Microsoft.AspNetCore.Http;
using Tdn.Models.Access;

namespace Tdn.Tests.Fixtures;

public class TestHttpContextAccessor : IHttpContextAccessor
{
    public HttpContext? HttpContext { get; set; }

    public TestHttpContextAccessor(Subject? subject = null)
    {
        var context = new DefaultHttpContext();
        if (subject != null)
            context.Items["Subject"] = subject;
        HttpContext = context;
    }
}
