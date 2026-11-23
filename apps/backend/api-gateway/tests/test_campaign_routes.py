import json
import re
import unittest

import yaml

from test_support import GATEWAY


CAMPAIGN_SERVICE = GATEWAY.parent / "campaign-service"
HTTP_ATTRIBUTE = re.compile(r"\[Http(Get|Post|Put|Delete|Patch|Head|Options)(?:\s*\((.*?)\))?\]", re.DOTALL)
ROUTE_ATTRIBUTE = re.compile(r'\[Route\s*\(\s*"([^"]*)"\s*\)\]')
QUOTED_VALUE = re.compile(r'"([^"]*)"')
PLACEHOLDER_CONSTRAINT = re.compile(r":(?:int|guid)\b")


def controller_endpoints():
    endpoints = set()
    controller_files = sorted((CAMPAIGN_SERVICE / "Source" / "Http").glob("*Controller.cs"))
    if not controller_files:
        raise AssertionError(f"no campaign-service controller files found in {CAMPAIGN_SERVICE / 'Source' / 'Http'}")
    for file_path in controller_files:
        source = file_path.read_text()
        routes = ROUTE_ATTRIBUTE.findall(source)
        if len(routes) != 1:
            raise AssertionError(f"{file_path} must contain exactly one supported [Route(\"...\")] attribute")
        attributes = list(HTTP_ATTRIBUTE.finditer(source))
        if not attributes:
            raise AssertionError(f"{file_path} contains no supported HTTP action attributes")
        unsupported = re.search(r"\[Http[A-Za-z]+\b", source)
        if unsupported and len(re.findall(r"\[Http[A-Za-z]+\b", source)) != len(attributes):
            raise AssertionError(f"{file_path} contains an unsupported HTTP attribute format")
        for attribute in attributes:
            method = attribute.group(1).upper()
            argument = attribute.group(2) or ""
            if argument and not argument.lstrip().startswith('"'):
                raise AssertionError(f"{file_path} contains an unsupported [Http{method.title()}(...)] argument format")
            values = QUOTED_VALUE.findall(argument)
            suffix = values[0] if values else ""
            path = "/".join(part.strip("/") for part in (routes[0], suffix) if part.strip("/"))
            path = "/" + PLACEHOLDER_CONSTRAINT.sub("", path)
            endpoint = (method, path)
            if endpoint in endpoints:
                raise AssertionError(f"duplicate campaign-service endpoint {method} {path} in {file_path}")
            endpoints.add(endpoint)
    if not endpoints:
        raise AssertionError("no campaign-service controller endpoints were discovered")
    return endpoints


class CampaignRouteTests(unittest.TestCase):
    def test_permissions_routes_are_read_only_subject_scoped_proxies(self):
        config = yaml.safe_load((GATEWAY / "configs" / "routes.yaml").read_text())
        routes = {route["path"]: route for route in config["routes"] if isinstance(route, dict)}
        paths = (
            "/api/campaigns/{campaignId}/permissions",
            "/api/campaigns/{campaignId}/characters/{characterId}/permissions",
        )
        for path in paths:
            route = routes[path]
            self.assertEqual(["GET"], route["methods"])
            self.assertEqual(path, route["proxy"]["path"])
            self.assertEqual("{state.x_subject}", route["proxy"]["headers"]["X-Subject"])
            self.assertEqual("campaign_upstream", route["pre_request_handler"])
            self.assertEqual("campaign_response", route["response_handler"])
            self.assertEqual("required", route["auth"])
            self.assertNotIn("params", route)
            self.assertNotIn("access", route)

    def test_gateway_campaign_routes_match_all_controller_actions(self):
        config = yaml.safe_load((GATEWAY / "configs" / "routes.yaml").read_text())
        campaign_routes = [route for route in config["routes"] if isinstance(route, dict) and route.get("proxy", {}).get("service") == "campaign"]
        actual = []
        for route in campaign_routes:
            methods = route.get("methods")
            if not isinstance(methods, list):
                methods = list(methods or {})
            actual.extend((method.upper(), route["path"]) for method in methods)
            self.assertEqual(route["proxy"].get("path"), route["path"])
            self.assertEqual(route.get("auth"), "required")
            self.assertEqual(route.get("pre_request_handler"), "campaign_upstream")
            self.assertEqual(route.get("response_handler"), "campaign_response")
            self.assertEqual(route["proxy"].get("headers", {}).get("X-Subject"), "{state.x_subject}")
            self.assertNotIn("params", route)
            self.assertNotIn("skip_body", route["proxy"])
            self.assertNotIn("access", route)
            self.assertNotIn("response", route)
        self.assertEqual(len(actual), len(set(actual)), "duplicate Gateway campaign method/path pairs")
        self.assertEqual(set(actual), controller_endpoints())
        for _, path in actual:
            self.assertNotIn("*", path)
            self.assertNotRegex(path, r"\{[^}]+:[^}]+\}")
            self.assertFalse(path.startswith("/groups"))
            self.assertNotIn("/polices/", path)

    def test_singleton_template_routes_have_only_get_and_put_methods(self):
        config = yaml.safe_load((GATEWAY / "configs" / "routes.yaml").read_text())
        routes = {route["path"]: route for route in config["routes"] if isinstance(route, dict)}
        expected = {
            "/api/campaigns/{campaignId}/template",
            "/api/campaigns/{campaignId}/template/content",
            "/api/campaigns/{campaignId}/template/virtual-fields",
        }
        singleton = {path: route for path, route in routes.items() if "/template" in path}
        self.assertEqual(expected, set(singleton))
        for path, route in singleton.items():
            self.assertEqual(["GET", "PUT"], route["methods"])
            self.assertEqual(path, route["proxy"]["path"])
            self.assertEqual("{state.x_subject}", route["proxy"]["headers"]["X-Subject"])
            self.assertEqual("campaign_upstream", route["pre_request_handler"])
            self.assertEqual("campaign_response", route["response_handler"])
            self.assertEqual("required", route["auth"])
        self.assertNotIn("/api/campaigns/{campaignId}/templates", routes)
        self.assertFalse(any(re.search(r"/templates/\{[^}]+\}", path) for path in routes))

    def test_item_and_skill_catalog_routes_are_separate_exact_subject_scoped_proxies(self):
        config = yaml.safe_load((GATEWAY / "configs" / "routes.yaml").read_text())
        routes = {route["path"]: route for route in config["routes"] if isinstance(route, dict)}
        expected_suffixes = {
            "": ["GET", "POST"],
            "/{entryId}": ["GET", "PUT"],
            "/{entryId}/content": ["GET", "PUT"],
            "/attributes": ["GET", "PUT"],
            "/attributes/{attributeId}": ["DELETE"],
            "/groups": ["GET", "PUT"],
            "/groups/configuration": ["GET"],
            "/groups/{groupId}/entries": ["GET"],
        }
        for scope in ("items", "skills"):
            prefix = f"/api/campaigns/{{campaignId}}/{scope}"
            expected = {prefix + suffix: methods for suffix, methods in expected_suffixes.items()}
            actual = {path: route for path, route in routes.items() if path == prefix or path.startswith(prefix + "/")}
            self.assertEqual(set(expected), set(actual))
            for path, methods in expected.items():
                route = actual[path]
                self.assertEqual(methods, route["methods"])
                self.assertEqual(path, route["proxy"]["path"])
                self.assertEqual({"X-Subject": "{state.x_subject}"}, route["proxy"]["headers"])
                self.assertEqual("campaign_upstream", route["pre_request_handler"])
                self.assertEqual("campaign_response", route["response_handler"])
                self.assertEqual("required", route["auth"])
                for key in ("params", "query", "body", "access"):
                    self.assertNotIn(key, route)
                    self.assertNotIn(key, route["proxy"])
        for path in (
            "/api/campaigns/{campaignId}/catalog",
            "/api/campaigns/{campaignId}/catalog/attributes",
            "/api/campaigns/{campaignId}/catalog/groups",
        ):
            self.assertNotIn(path, routes)

    def test_character_item_and_skill_routes_are_separate_with_item_quantity_only(self):
        config = yaml.safe_load((GATEWAY / "configs" / "routes.yaml").read_text())
        routes = {route["path"]: route for route in config["routes"] if isinstance(route, dict)}
        expected_common = {
            "": ["GET", "POST"],
            "/create": ["POST"],
            "/additions/{requestId}": ["GET"],
            "/{entryId}": ["GET", "DELETE"],
            "/{entryId}/attributes": ["PUT"],
        }
        for scope in ("items", "skills"):
            prefix = f"/api/campaigns/{{campaignId}}/characters/{{characterId}}/{scope}"
            expected = {prefix + suffix: methods for suffix, methods in expected_common.items()}
            if scope == "items":
                expected[f"{prefix}/{{entryId}}/quantity"] = ["PUT"]
            actual = {path: route for path, route in routes.items() if path == prefix or path.startswith(prefix + "/")}
            self.assertEqual(set(expected), set(actual))
            for path, methods in expected.items():
                route = actual[path]
                self.assertEqual(methods, route["methods"])
                self.assertEqual(path, route["proxy"]["path"])
                self.assertEqual({"X-Subject": "{state.x_subject}"}, route["proxy"]["headers"])
                self.assertEqual("campaign_upstream", route["pre_request_handler"])
                self.assertEqual("campaign_response", route["response_handler"])
                self.assertEqual("required", route["auth"])
                for key in ("params", "query", "body", "access"):
                    self.assertNotIn(key, route)
                    self.assertNotIn(key, route["proxy"])
        self.assertNotIn("/api/campaigns/{campaignId}/characters/{characterId}/entries", routes)

    def test_app_configs_include_routes_without_game_systems(self):
        for filename in ("app.json", "app.test.json"):
            config = json.loads((GATEWAY / "configs" / filename).read_text())
            self.assertIn("routes.yaml", config["routes"]["files"])
            self.assertNotIn("game-systems.yaml", config["routes"]["files"])

    def test_existing_non_campaign_routes_keep_authentication_contract(self):
        config = yaml.safe_load((GATEWAY / "configs" / "routes.yaml").read_text())
        routes = {route["path"]: route for route in config["routes"]}
        self.assertEqual(routes["/get_api"].get("auth"), "none")
        self.assertEqual(routes["/whoami"].get("auth"), "required")
        for path in ("/auth/register", "/auth/check", "/auth/reset-password/confirm", "/auth/token", "/.well-known/jwks.json"):
            self.assertEqual(routes[path].get("handler"), "legacy_auth_unavailable")
            self.assertEqual(routes[path].get("auth"), "none")
        self.assertEqual(routes["/users"]["methods"]["POST"], {"handler": "user_create", "auth": "required"})
        self.assertEqual(routes["/users"]["methods"]["GET"]["auth"], "none")
        self.assertEqual(routes["/users/{user_id}"]["auth"], "required")
        self.assertEqual(routes["/users/{user_id}"]["methods"]["PATCH"]["access"], "self_only")
        self.assertEqual(routes["/users/{user_id}/settings"]["auth"], "required")
        self.assertTrue(all(method["access"] == "self_only" for method in routes["/users/{user_id}/settings"]["methods"].values()))


if __name__ == "__main__":
    unittest.main()
