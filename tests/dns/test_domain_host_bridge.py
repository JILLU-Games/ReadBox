"""DOMAIN-AUTO-01 disposable broker contract; no real host, R2 or keys."""
import importlib.util
import pathlib
import sys
import types
import unittest
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parents[2]
AGENT = ROOT / "deployment" / "backup-agent" / "agent.py"

# Only stub unrelated backup modules: import the real broker and exercise perform().
for name, exports in {
    "executor": {"BackupExecutor": object, "BackupExecutionError": type("E", (Exception,), {})},
    "storage": {"PrivateStore": object, "private_dir": lambda x: x,
                "valid_id": lambda x: True},
    "r2": {"R2Adapter": lambda state, executor: types.SimpleNamespace(),
           "R2Error": type("E", (Exception,), {})},
    "scheduler": {"ScheduleManager": lambda state: types.SimpleNamespace(),
                  "ScheduleError": type("E", (Exception,), {})},
    "restore": {"preflight": lambda *args: None, "production_gate": lambda *args: False,
                "RestoreError": type("E", (Exception,), {})},
}.items():
    module = types.ModuleType(name)
    for attr, value in exports.items():
        setattr(module, attr, value)
    sys.modules[name] = module

spec = importlib.util.spec_from_file_location("readbox_domain_broker", AGENT)
broker_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(broker_module)


class HostBridgeTest(unittest.TestCase):
    def setUp(self):
        self.broker = broker_module.BackupBroker(
            types.SimpleNamespace(), types.SimpleNamespace(), b"test"
        )

    def test_rejects_arbitrary_commands_and_paths_before_exec(self):
        for payload in [
            {"action": "dkim.escrow", "domain": "../etc/passwd"},
            {"action": "dkim.escrow", "domain": "EXAMPLE.test"},
            {"action": "dkim.escrow", "domain": "example.test", "command": "restore"},
        ]:
            with mock.patch.object(broker_module.subprocess, "run") as execute:
                code, reply = self.broker.perform(payload)
            self.assertEqual(code, 400)
            self.assertEqual(reply, {"error": "DKIM_DOMAIN_INVALID"})
            execute.assert_not_called()

    def test_exact_domain_executes_only_pinned_escrow(self):
        completed = types.SimpleNamespace(returncode=0,
            stdout='{"escrow":"verified","domain":"example.test"}')
        with (mock.patch.object(broker_module.Path, "is_file", return_value=True),
              mock.patch.object(broker_module.Path, "is_symlink", return_value=False),
              mock.patch.object(broker_module.subprocess, "run", return_value=completed) as execute):
            code, result = self.broker.perform({
                "action": "dkim.escrow", "domain": "example.test"})
        self.assertEqual((code, result), (200, {"escrow": "verified"}))
        args = execute.call_args
        self.assertEqual(args.args[0], [
            sys.executable, "/opt/readbox/deployment/dkim/escrow.py",
            "escrow", "example.test"])
        self.assertTrue(args.kwargs["capture_output"])

    def test_failed_escrow_never_exposes_underlying_secret_stdout_stderr(self):
        failed = types.SimpleNamespace(returncode=2,
            stdout="sensitive-secret", stderr="sensitive-secret")
        with (mock.patch.object(broker_module.Path, "is_file", return_value=True),
              mock.patch.object(broker_module.Path, "is_symlink", return_value=False),
              mock.patch.object(broker_module.subprocess, "run", return_value=failed)):
            code, result = self.broker.perform({
                "action": "dkim.escrow", "domain": "example.test"})
        self.assertEqual((code, result), (409, {"error": "DKIM_ESCROW_REFUSED"}))


if __name__ == "__main__":
    unittest.main()
