class IngressIdentitySanitizer:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            blocked = {b"x-subject", b"x-user-id", b"x-account-id", b"x-account-service-key", b"x-internal-service-key"}
            scope["headers"] = [(name, value) for name, value in scope["headers"] if name.lower() not in blocked]
        await self.app(scope, receive, send)
