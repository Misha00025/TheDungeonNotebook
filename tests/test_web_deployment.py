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
            env = os.environ.copy()
            for key in COMPOSE_ENV_KEYS:
                env.pop(key, None)
            result = subprocess.run(
                command, cwd=directory, env=env, capture_output=True, text=True, check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)

    def test_images_ports_and_pull_policy_use_defaults(self):
        services = self.config()["services"]
        expected = {
            "campaign": ("tdn-campaign:latest", "3000"),
            "profile": ("tdn-profile:latest", "3002"),
            "login": ("tdn-login:latest", "3003"),
            "hub": ("tdn-hub:latest", "3004"),
        }
        self.assertEqual(set(services), set(expected))
        for name, (image, published) in expected.items():
            with self.subTest(service=name):
                service = services[name]
                self.assertEqual(service["image"], image)
                self.assertEqual(service["pull_policy"], "never")
                self.assertEqual(service["restart"], "unless-stopped")
                port = service["ports"][0]
                self.assertEqual(str(port["published"]), published)
                self.assertEqual(port["target"], 3000)

    def test_compose_has_no_build_checkout_mounts_or_external_dependencies(self):
        config = self.config()
        for key in ("networks", "volumes"):
            for resource in config.get(key, {}).values():
                self.assertFalse(resource.get("external", False))
        for service in config["services"].values():
            for key in ("build", "volumes", "include", "extends", "env_file", "depends_on"):
                self.assertNotIn(key, service)
            self.assertNotIn("container_name", service)

    def test_env_file_overrides_runtime_settings(self):
        config = self.config({
            "BFF_BASE": "http://web.example.test/bff",
            "API_BASE": "http://web.example.test/bff/api-v2",
            "CAMPAIGN_PORT": "13000",
            "PROFILE_PORT": "13002",
            "LOGIN_PORT": "13003",
            "HUB_PORT": "13004",
            "APP_PULL_POLICY": "missing",
        })
        services = config["services"]
        self.assertEqual(services["hub"]["environment"], {
            "BFF_BASE": "http://web.example.test/bff",
            "API_BASE": "http://web.example.test/bff/api-v2",
        })
        for name, published in (("campaign", "13000"), ("profile", "13002"),
                                ("login", "13003"), ("hub", "13004")):
            self.assertEqual(str(services[name]["ports"][0]["published"]), published)
            self.assertEqual(services[name]["pull_policy"], "missing")

    def test_empty_api_base_is_left_for_hub_entrypoint_to_derive(self):
        hub = self.config({"BFF_BASE": "http://browser-host:5080/bff"})["services"]["hub"]
        self.assertEqual(hub["environment"]["BFF_BASE"], "http://browser-host:5080/bff")
        self.assertEqual(hub["environment"]["API_BASE"], "")


if __name__ == "__main__":
    unittest.main()
