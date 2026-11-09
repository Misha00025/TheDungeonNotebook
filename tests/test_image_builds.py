import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SERVICES = (
    "api-gateway auth-service users-service campaign-service game-systems-service "
    "sync-service admin-panel web-hub web-campaign web-profile web-login web-game-systems"
).split()


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
            " log.write(json.dumps({'argv': sys.argv[1:], 'image_tag': os.environ.get('IMAGE_TAG')}) + '\\n')\n"
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
        self.assertEqual(call["argv"][call["argv"].index("--env-file") + 1], "web/template.env.build")
        self.log.unlink()
        call = self.assert_build_services(
            ["build", "SERVICE=web-login", "WEB_BUILD_ENV=.env.build"], ["web-login"]
        )
        self.assertEqual(call["argv"][call["argv"].index("--env-file") + 1], "web/.env.build")
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


if __name__ == "__main__":
    unittest.main()
