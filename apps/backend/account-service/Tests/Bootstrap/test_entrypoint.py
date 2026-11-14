import json
import os
import pathlib
import stat
import subprocess
import sys
import tempfile
import unittest


SERVICE_DIR = pathlib.Path(__file__).resolve().parents[2]
ENTRYPOINT = SERVICE_DIR / "entrypoint.sh"
TEMPLATE = SERVICE_DIR / "config" / "accounts.template.json"


class EntrypointBootstrapTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name)
        self.config = self.root / "config dir" / "accounts.json"
        self.fake_app = self.root / "fake app.py"
        self.fake_app.write_text(
            "import json, os, pathlib, sys\n"
            "path = pathlib.Path(os.environ['ACCOUNT_CONFIG'])\n"
            "json.loads(path.read_text())\n"
            "pathlib.Path(os.environ['ARGS_OUTPUT']).write_text(json.dumps(sys.argv[1:]))\n"
            "raise SystemExit(int(os.environ.get('FAKE_EXIT', '0')))\n"
        )

    def tearDown(self):
        self.temp.cleanup()

    def run_entrypoint(self, config=None, *extra, script=ENTRYPOINT, env=None):
        child_env = os.environ.copy()
        child_env.update({"ACCOUNT_CONFIG": str(config or self.config), "ARGS_OUTPUT": str(self.root / "args.json")})
        if env:
            child_env.update(env)
        return subprocess.run(
            ["sh", str(script), sys.executable, str(self.fake_app), *extra],
            env=child_env,
            capture_output=True,
            text=True,
        )

    def test_missing_config_is_created_and_application_executes(self):
        result = self.run_entrypoint(self.config, "first", "two words")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(self.config.read_text()), json.loads(TEMPLATE.read_text()))
        self.assertEqual(json.loads((self.root / "args.json").read_text()), ["first", "two words"])
        self.assertEqual(stat.S_IMODE(self.config.stat().st_mode), 0o600)
        self.assertEqual(list(self.config.parent.glob(".accounts.json.*")), [])

    def test_existing_file_content_and_permissions_are_preserved(self):
        self.config.parent.mkdir(parents=True)
        self.config.write_text('{"kept":true}\n')
        self.config.chmod(0o640)
        before = self.config.stat()
        result = self.run_entrypoint(self.config)
        after = self.config.stat()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.config.read_text(), '{"kept":true}\n')
        self.assertEqual(stat.S_IMODE(after.st_mode), 0o640)
        self.assertEqual((after.st_ino, after.st_uid, after.st_gid), (before.st_ino, before.st_uid, before.st_gid))

    def test_custom_config_setting_and_arguments_reach_application(self):
        result = self.run_entrypoint(self.config, "arg")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads((self.root / "args.json").read_text()), ["arg"])
        self.assertTrue(self.config.is_file())

    def test_directory_symlink_and_dangling_symlink_are_rejected(self):
        directory = self.root / "directory"
        directory.mkdir()
        dangling = self.root / "dangling"
        dangling.symlink_to(self.root / "absent")
        target = self.root / "target"
        target.write_text("unchanged")
        link = self.root / "link"
        link.symlink_to(target)
        for path in (directory, dangling, link):
            with self.subTest(path=path):
                result = self.run_entrypoint(path)
                self.assertNotEqual(result.returncode, 0)
        self.assertEqual(target.read_text(), "unchanged")

    def test_missing_template_fails_without_creating_config(self):
        isolated = self.root / "isolated"
        isolated.mkdir()
        script = isolated / "entrypoint.sh"
        script.write_text(ENTRYPOINT.read_text())
        target = self.root / "missing-template-config" / "accounts.json"
        result = self.run_entrypoint(target, script=script)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(target.exists())

    def test_concurrent_bootstraps_publish_one_config_without_temp_files(self):
        self.config.parent.mkdir(parents=True)
        processes = [
            subprocess.Popen(
                ["sh", str(ENTRYPOINT), sys.executable, str(self.fake_app)],
                env={**os.environ, "ACCOUNT_CONFIG": str(self.config), "ARGS_OUTPUT": str(self.root / f"args-{i}.json")},
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            for i in range(6)
        ]
        for process in processes:
            stdout, stderr = process.communicate()
            self.assertEqual(process.returncode, 0, stderr.decode())
        self.assertEqual(json.loads(self.config.read_text()), json.loads(TEMPLATE.read_text()))
        self.assertEqual(list(self.config.parent.iterdir()), [self.config])

    def test_application_exit_status_is_propagated(self):
        result = self.run_entrypoint(self.config, env={"FAKE_EXIT": "23"})
        self.assertEqual(result.returncode, 23)


if __name__ == "__main__":
    unittest.main()
