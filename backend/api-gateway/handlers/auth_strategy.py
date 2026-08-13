import logging
import jwt
from app.engine.registry import register_auth_strategy
from app.engine.context import RouteContext

logger = logging.getLogger(__name__)


@register_auth_strategy("hybrid_jwt")
def hybrid_jwt_factory(config):
    public_key_path = config.public_key_path
    expected_issuer = config.expected_issuer

    with open(public_key_path, "rb") as f:
        public_key = f.read()

    def _validate(ctx: RouteContext):
        try:
            token = None
            token_from_cookie = False

            # Priority 1: Cookie (SPA clients)
            if ctx.request.cookies:
                token = ctx.request.cookies.get("access_token")
                token_from_cookie = bool(token)

            # Priority 2: Authorization Bearer header (mobile/service clients)
            if not token:
                auth = ctx.request.headers.get("Authorization")
                if auth:
                    if auth.startswith("Bearer "):
                        token = auth[7:]
                    else:
                        token = auth  # without prefix — use as-is

            if not token:
                logger.warning("hybrid_jwt: no token found (no cookie, no auth header)")
                return None

            options = {
                "verify_signature": True,
                "verify_exp": True,
                "verify_aud": False,
            }
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                options=options,
            )

            if expected_issuer and payload.get("iss") and payload["iss"] != expected_issuer:
                logger.warning("hybrid_jwt: issuer mismatch (expected=%s, got=%s)", expected_issuer, payload.get("iss"))
                return None

            # Refresh cookie Max-Age if token came from cookie
            if token_from_cookie:
                ctx.response.set_cookie(
                    "access_token",
                    token,
                    httponly=True,
                    samesite="strict",
                    max_age=180,
                    path="/",
                )

            # --- X-Subject injection (for campaign-service) ---
            uid = payload.get("userId")
            gid = payload.get("groupId")

            import json
            if uid is not None:
                ctx.state["x_subject"] = json.dumps({"type": "user", "id": int(uid)})
                logger.info("X-Subject injected: type=user, id=%s", uid)
            elif gid is not None:
                ctx.state["x_subject"] = json.dumps({"type": "group", "id": int(gid)})
                logger.info("X-Subject injected: type=group, id=%s", gid)
            else:
                logger.info("X-Subject NOT injected: no userId or groupId in JWT")
            # --- /X-Subject injection ---

            return payload
        except jwt.ExpiredSignatureError:
            logger.warning("hybrid_jwt: token expired")
            return None
        except jwt.PyJWTError:
            logger.warning("hybrid_jwt: invalid token")
            return None
        except Exception as e:
            logger.warning("hybrid_jwt: unexpected error: %s", e)
            return None

    return _validate
