import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
COMPOSE_ENV_KEYS = (
    "BFF_BASE",
    "API_BASE",
    "WEB_PORT",
    "WEB_BASE_PATH",
    "WEB_CAMPAIGN_PATH",
    "WEB_PROFILE_PATH",
    "WEB_LOGIN_PATH",
    "WEB_HUB_UPSTREAM",
    "WEB_CAMPAIGN_UPSTREAM",
    "WEB_PROFILE_UPSTREAM",
    "WEB_LOGIN_UPSTREAM",
    "WEB_DNS_RESOLVER",
    "CAMPAIGN_PORT",
    "PROFILE_PORT",
    "LOGIN_PORT",
    "HUB_PORT",
    "APP_PULL_POLICY",
    "COMPOSE_FILE",
    "COMPOSE_PROJECT_NAME",
    "COMPOSE_PROFILES",
    "COMPOSE_ENV_FILES",
    "COMPOSE_DISABLE_ENV_FILE",
)


class WebDeploymentComposeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.docker = shutil.which("docker")
        if cls.docker is None:
            raise unittest.SkipTest("Docker CLI is not installed")
        version = subprocess.run(
            [cls.docker, "compose", "version"], capture_output=True, text=True, check=False,
        )
        if version.returncode != 0:
            raise unittest.SkipTest("Docker Compose is not installed")

    def clean_env(self):
        env = os.environ.copy()
        for key in COMPOSE_ENV_KEYS:
            env.pop(key, None)
        return env

    def config(self, env_values=None):
        temporary_root = "/tmp/opencode" if Path("/tmp/opencode").is_dir() else None
        with tempfile.TemporaryDirectory(dir=temporary_root) as temporary:
            directory = Path(temporary)
            shutil.copy(ROOT / "deploy/web/docker-compose.yaml", directory)
            command = [self.docker, "compose", "-f", "docker-compose.yaml"]
            if env_values is not None:
                shutil.copy(ROOT / "deploy/web/.env.example", directory / ".env")
                env_file = directory / ".env"
                contents = env_file.read_text()
                for key, value in env_values.items():
                    lines = contents.splitlines()
                    contents = "\n".join(
                        f"{key}={value}" if line.startswith(f"{key}=") else line
                        for line in lines
                    ) + "\n"
                    env_file.write_text(contents)
                command.extend(("--env-file", str(env_file)))
            command.extend(("config", "--format", "json"))
            result = subprocess.run(
                command, cwd=directory, env=self.clean_env(), capture_output=True, text=True, check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)

    def source_config(self):
        result = subprocess.run(
            [self.docker, "compose", "--env-file", "apps/web/template.env", "-f",
             "apps/web/docker-compose.yaml", "config", "--format", "json"],
            cwd=ROOT, env=self.clean_env(), capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_images_and_published_port_use_defaults(self):
        services = self.config()["services"]
        expected = {
            "campaign": "tdn-campaign:latest",
            "profile": "tdn-profile:latest",
            "login": "tdn-login:latest",
            "hub": "tdn-hub:latest",
            "nginx": "tdn-web-proxy:latest",
        }
        self.assertEqual(set(services), set(expected))
        for name, image in expected.items():
            with self.subTest(service=name):
                service = services[name]
                self.assertEqual(service["image"], image)
                self.assertEqual(service["pull_policy"], "never")
                self.assertEqual(service["restart"], "unless-stopped")
                if name == "nginx":
                    port = service["ports"][0]
                    self.assertEqual(str(port["published"]), "3004")
                    self.assertEqual(port["target"], 80)
                else:
                    self.assertNotIn("ports", service)

    def test_compose_has_no_build_checkout_mounts_or_external_dependencies(self):
        config = self.config()
        for key in ("networks", "volumes"):
            for resource in config.get(key, {}).values():
                self.assertFalse(resource.get("external", False))
        for service in config["services"].values():
            for key in ("build", "volumes", "include", "extends", "env_file", "depends_on"):
                self.assertNotIn(key, service)
            self.assertNotIn("container_name", service)

    def test_nginx_environment_defaults_and_overrides(self):
        defaults = self.config()["services"]["nginx"]["environment"]
        self.assertEqual(defaults, {
            "BFF_BASE": "http://localhost:5080/bff",
            "API_BASE": "",
            "WEB_BASE_PATH": "/",
            "WEB_CAMPAIGN_PATH": "/remotes/campaign/",
            "WEB_PROFILE_PATH": "/remotes/profile/",
            "WEB_LOGIN_PATH": "/remotes/login/",
            "WEB_HUB_UPSTREAM": "http://hub:3000",
            "WEB_CAMPAIGN_UPSTREAM": "http://campaign:3000",
            "WEB_PROFILE_UPSTREAM": "http://profile:3000",
            "WEB_LOGIN_UPSTREAM": "http://login:3000",
            "WEB_DNS_RESOLVER": "127.0.0.11",
        })
        config = self.config({
            "BFF_BASE": "http://browser.example.test/bff",
            "API_BASE": "",
            "WEB_PORT": "3804",
            "WEB_BASE_PATH": "/notebook/",
            "WEB_CAMPAIGN_PATH": "/public-campaign/",
            "WEB_PROFILE_PATH": "/public-profile/",
            "WEB_LOGIN_PATH": "/public-login/",
            "WEB_HUB_UPSTREAM": "http://hub-internal:3100",
            "WEB_CAMPAIGN_UPSTREAM": "http://campaign-internal:3101",
            "WEB_PROFILE_UPSTREAM": "http://profile-internal:3102",
            "WEB_LOGIN_UPSTREAM": "http://login-internal:3103",
            "WEB_DNS_RESOLVER": "10.0.0.2",
            "APP_PULL_POLICY": "missing",
        })["services"]
        nginx = config["nginx"]
        self.assertEqual(nginx["environment"]["BFF_BASE"], "http://browser.example.test/bff")
        self.assertEqual(nginx["environment"]["API_BASE"], "")
        self.assertEqual(nginx["environment"]["WEB_BASE_PATH"], "/notebook/")
        self.assertEqual(nginx["environment"]["WEB_CAMPAIGN_PATH"], "/public-campaign/")
        self.assertEqual(nginx["environment"]["WEB_PROFILE_PATH"], "/public-profile/")
        self.assertEqual(nginx["environment"]["WEB_LOGIN_PATH"], "/public-login/")
        self.assertEqual(nginx["environment"]["WEB_HUB_UPSTREAM"], "http://hub-internal:3100")
        self.assertEqual(nginx["environment"]["WEB_CAMPAIGN_UPSTREAM"], "http://campaign-internal:3101")
        self.assertEqual(nginx["environment"]["WEB_PROFILE_UPSTREAM"], "http://profile-internal:3102")
        self.assertEqual(nginx["environment"]["WEB_LOGIN_UPSTREAM"], "http://login-internal:3103")
        self.assertEqual(nginx["environment"]["WEB_DNS_RESOLVER"], "10.0.0.2")
        self.assertEqual(str(nginx["ports"][0]["published"]), "3804")
        for service in config.values():
            self.assertEqual(service["pull_policy"], "missing")

    def test_empty_api_base_is_passed_to_runtime_generator(self):
        nginx = self.config({"BFF_BASE": "http://browser-host:5080/bff", "API_BASE": ""})["services"]["nginx"]
        self.assertEqual(nginx["environment"]["BFF_BASE"], "http://browser-host:5080/bff")
        self.assertEqual(nginx["environment"]["API_BASE"], "")

    def test_source_compose_keeps_app_services_internal_and_builds_proxy(self):
        services = self.source_config()["services"]
        self.assertEqual(set(services), {"campaign", "hub", "profile", "login", "nginx"})
        for name in ("campaign", "hub", "profile", "login"):
            self.assertNotIn("ports", services[name])
        self.assertNotIn("environment", services["hub"])
        self.assertNotIn("env_file", services["hub"])
        self.assertEqual(Path(services["nginx"]["build"]["context"]).resolve(), (ROOT / "apps/web/proxy").resolve())
        self.assertEqual(services["nginx"]["image"], "tdn-web-proxy:latest")


if __name__ == "__main__":
    unittest.main()
