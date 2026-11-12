import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SERVICES = (
    "api-gateway auth-service users-service campaign-service game-systems-service "
    "sync-service admin-panel web-hub web-campaign web-profile web-login web-game-systems"
).split()
IMAGE_REPOSITORIES = {
    "api-gateway": "backend-api-gateway",
    "auth-service": "backend-auth-service",
    "users-service": "backend-users-service",
    "campaign-service": "backend-campaign-service",
    "game-systems-service": "backend-game-systems-service",
    "sync-service": "backend-sync-service",
    "admin-panel": "admin-admin-panel",
    "web-hub": "tdn-hub",
    "web-campaign": "tdn-campaign",
    "web-profile": "tdn-profile",
    "web-login": "tdn-login",
    "web-game-systems": "tdn-game-systems",
}
BUILD_CONTEXTS = {
    "api-gateway": ("apps/backend/api-gateway", "Dockerfile"),
    "auth-service": ("apps/backend/auth-service", "Dockerfile"),
    "users-service": ("apps/backend/users-service", "Dockerfile"),
    "campaign-service": ("apps/backend", "campaign-service/Dockerfile"),
    "game-systems-service": ("apps/backend", "game-systems-service/Dockerfile"),
    "sync-service": ("apps/backend/sync-service", "Dockerfile"),
    "admin-panel": ("apps/admin", "Dockerfile"),
    "web-hub": ("apps/web", "apps/hub/Dockerfile"),
    "web-campaign": ("apps/web", "apps/campaign/Dockerfile"),
    "web-profile": ("apps/web", "apps/profile/Dockerfile"),
    "web-login": ("apps/web", "apps/login/Dockerfile"),
    "web-game-systems": ("apps/web", "apps/game-systems/Dockerfile"),
}


class RepositoryLayoutTests(unittest.TestCase):
    def test_application_directories_are_under_apps(self):
        for name in ("admin", "backend", "web"):
            with self.subTest(name=name):
                self.assertFalse((ROOT / name).exists())
                self.assertTrue((ROOT / "apps" / name).is_dir())


class ImageBuildComposeConfigTests(unittest.TestCase):
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

    def config(self, tag=None):
        env = os.environ.copy()
        env.pop("IMAGE_TAG", None)
        if tag is not None:
            env["IMAGE_TAG"] = tag
        result = subprocess.run(
            [self.docker, "compose", "--env-file", "apps/web/template.env.build", "-f",
             "docker-compose.build.yaml", "config", "--format", "json"],
            cwd=ROOT, env=env, capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def assert_config_tags(self, tag):
        config = self.config(tag)
        services = config["services"]
        self.assertEqual(set(services), set(SERVICES))
        self.assertEqual(len(services), 12)
        for service_name, repository in IMAGE_REPOSITORIES.items():
            with self.subTest(service=service_name, tag=tag):
                service = services[service_name]
                self.assertEqual(service["image"], f"{repository}:{tag or 'latest'}")
                build_tags = service["build"]["tags"]
                self.assertIn(f"{repository}:latest", build_tags)
                self.assertTrue(all(value.split(":", 1)[0] == repository for value in build_tags))

    def test_default_latest_tags(self):
        self.assert_config_tags(None)

    def test_custom_tags_also_include_latest(self):
        for tag in ("1.2.3", "1.2.3-rc.1"):
            with self.subTest(tag=tag):
                self.assert_config_tags(tag)

    def test_build_contexts_and_dockerfiles_match_layout(self):
        services = self.config()["services"]
        self.assertEqual(set(BUILD_CONTEXTS), set(services))
        for service_name, (relative_context, expected_dockerfile) in BUILD_CONTEXTS.items():
            with self.subTest(service=service_name):
                build = services[service_name]["build"]
                context = Path(build["context"])
                self.assertEqual(context.resolve(), (ROOT / relative_context).resolve())
                self.assertTrue(context.is_dir())
                self.assertEqual(build.get("dockerfile", "Dockerfile"), expected_dockerfile)
                self.assertTrue((context / expected_dockerfile).is_file())

    def test_backend_runtime_compose_config_uses_migrated_paths(self):
        result = subprocess.run(
            [self.docker, "compose", "--env-file", str(ROOT / "template.env"), "-f",
             str(ROOT / "apps/backend/docker-compose.yaml"), "config",
             "--no-env-resolution", "--format", "json"],
            cwd=ROOT, capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        config = json.loads(result.stdout)
        services = config["services"]
        campaign_build = services["campaign-service"]["build"]
        self.assertEqual(Path(campaign_build["context"]).resolve(), (ROOT / "apps/backend").resolve())
        self.assertEqual(campaign_build["dockerfile"], "campaign-service/Dockerfile")
        logs_volume = next(
            volume for volume in services["api-gateway"]["volumes"]
            if volume.get("target") == "/app/logs"
        )
        self.assertEqual(Path(logs_volume["source"]).resolve(), (ROOT / "logs").resolve())
        self.assertEqual(config["networks"]["backend-network"]["name"], "backend_backend-network")


class ImageBuildMakeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.log = self.directory / "docker.jsonl"
        docker = self.directory / "docker"
        docker.write_text(
            "#!/usr/bin/env python3\n"
            "import json, os, sys\n"
            "with open(os.environ['DOCKER_LOG'], 'a') as log:\n"
            " log.write(json.dumps({'argv': sys.argv[1:], 'image_tag': os.environ.get('IMAGE_TAG'), 'cwd': os.getcwd()}) + '\\n')\n"
        )
        docker.chmod(0o755)
        self.env = os.environ.copy()
        self.env["PATH"] = str(self.directory) + os.pathsep + self.env.get("PATH", "")
        self.env["DOCKER_LOG"] = str(self.log)
        self.env.pop("IMAGE_TAG", None)

    def make(self, *args, **kwargs):
        env = self.env.copy()
        env.update(kwargs.pop("env", {}))
        return subprocess.run(
            ["make", "--no-print-directory", "-C", str(ROOT), *args], capture_output=True, text=True,
            env=env, check=False,
        )

    def records(self):
        if not self.log.exists():
            return []
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def assert_build_services(self, args, expected, **kwargs):
        result = self.make(*args, **kwargs)
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.records()
        self.assertEqual(len(calls), 1)
        argv = calls[0]["argv"]
        build_index = argv.index("build")
        flags = []
        if "BUILD_FLAGS=--no-cache --pull" in args:
            flags = ["--no-cache", "--pull"]
        self.assertEqual(
            argv[:build_index + 1],
            ["compose", "--env-file", argv[2], "-f", "docker-compose.build.yaml", "build"],
        )
        self.assertEqual(argv[build_index + 1:], flags + expected)
        self.assertNotIn("--with-dependencies", argv)
        self.assertNotIn("up", argv)
        self.assertNotIn("run", argv)
        return calls[0]

    def test_list_images_and_help_do_not_call_docker(self):
        result = self.make("list-images")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.splitlines(), SERVICES)
        self.assertEqual(self.records(), [])
        result = self.make("help")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("make build", result.stdout)
        self.assertEqual(self.records(), [])

    def test_build_service_and_each_explicit_target(self):
        self.assert_build_services(["build", "SERVICE=auth-service"], ["auth-service"])
        for service in SERVICES:
            with self.subTest(service=service):
                self.log.unlink(missing_ok=True)
                self.assert_build_services([f"build-{service}"], [service])

    def test_group_targets_and_default_build(self):
        self.assert_build_services(["build-backend"], SERVICES[:6])
        self.log.unlink()
        self.assert_build_services(["build-admin"], ["admin-panel"])
        self.log.unlink()
        self.assert_build_services(["build-web"], SERVICES[7:])
        self.log.unlink()
        self.assert_build_services(["build"], SERVICES)

    def test_invalid_and_multiple_service_fail_before_docker(self):
        for service in ("not-a-service", "auth-service users-service"):
            with self.subTest(service=service):
                result = self.make("build", f"SERVICE={service}")
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("SERVICE", result.stderr)
                self.assertEqual(self.records(), [])

    def test_web_env_default_relative_and_absolute(self):
        call = self.assert_build_services(["build", "SERVICE=web-hub"], ["web-hub"])
        self.assertEqual(call["argv"][call["argv"].index("--env-file") + 1], "apps/web/template.env.build")
        self.log.unlink()
        call = self.assert_build_services(
            ["build", "SERVICE=web-login", "WEB_BUILD_ENV=.env.build"], ["web-login"]
        )
        self.assertEqual(call["argv"][call["argv"].index("--env-file") + 1], "apps/web/.env.build")
        self.log.unlink()
        absolute = str(self.directory / "params with spaces.env")
        call = self.assert_build_services(
            ["build", "SERVICE=web-login", f"WEB_BUILD_ENV={absolute}"], ["web-login"]
        )
        self.assertEqual(call["argv"][call["argv"].index("--env-file") + 1], absolute)

    def test_build_flags_and_image_tag(self):
        call = self.assert_build_services(
            ["build", "SERVICE=auth-service", "BUILD_FLAGS=--no-cache --pull", "IMAGE_TAG=ci"],
            ["auth-service"],
        )
        self.assertEqual(call["image_tag"], "ci")

    def test_image_tag_environment(self):
        call = self.assert_build_services(
            ["build", "SERVICE=auth-service"], ["auth-service"], env={"IMAGE_TAG": "from-env"}
        )
        self.assertEqual(call["image_tag"], "from-env")

    def test_run_targets_use_migrated_working_directories(self):
        backend = self.make("run-backend")
        self.assertEqual(backend.returncode, 0, backend.stderr)
        calls = self.records()
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]["cwd"], str(ROOT / "apps/backend"))
        self.assertEqual(calls[0]["argv"], ["compose", "up", "-d"])

        self.log.unlink()
        web = self.make("run-web")
        self.assertEqual(web.returncode, 0, web.stderr)
        calls = self.records()
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]["cwd"], str(ROOT / "apps/web"))
        self.assertEqual(calls[0]["argv"], ["compose", "--env-file", "template.env.build", "up", "-d"])


if __name__ == "__main__":
    unittest.main()
