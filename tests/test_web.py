"""Regression checks for the combined browser/API development entry point."""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch


ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('port_guard_web', ROOT / 'tools/web.py')
web = importlib.util.module_from_spec(spec)
spec.loader.exec_module(web)


class WebStartupTests(unittest.TestCase):
    def test_dev_starts_backend_before_ui_and_cleans_up(self):
        order = []
        worker = MagicMock()
        server = MagicMock()
        vite = MagicMock()
        vite.returncode = 0
        vite.poll.return_value = 0

        def backend(_database):
            order.append('backend')
            return worker

        def start_ui(*_args, **_kwargs):
            order.append('ui')
            return vite

        with patch.object(web.sys, 'argv', ['web.py', '--dev', '--database', '/tmp/port-guard-startup-test.sqlite3']), \
                patch.object(web, 'Worker', side_effect=backend), \
                patch.object(web, 'ThreadingHTTPServer', return_value=server) as http, \
                patch.object(web.shutil, 'which', return_value='/usr/bin/npm'), \
                patch.object(web.subprocess, 'Popen', side_effect=start_ui) as popen, \
                patch.object(web.threading, 'Thread') as thread:
            web.main()
            self.assertEqual(order, ['backend', 'ui'])
            self.assertEqual(http.call_args.args[0], ('127.0.0.1', 1421))
            self.assertTrue(server.api_only)
            self.assertEqual(popen.call_args.args[0][-2:], ['run', 'dev:ui'])
            thread.call_args.kwargs['target']()
            server.shutdown.assert_called_once()
            server.server_close.assert_called_once()
            worker.close.assert_called_once()

    def test_ui_failure_exits_with_error_and_closes_backend(self):
        worker = MagicMock()
        vite = MagicMock()
        vite.poll.return_value = 1
        vite.returncode = 1
        with patch.object(web.sys, 'argv', ['web.py', '--dev']), \
                patch.object(web, 'Worker', return_value=worker), \
                patch.object(web, 'ThreadingHTTPServer', return_value=MagicMock()), \
                patch.object(web.shutil, 'which', return_value='/usr/bin/npm'), \
                patch.object(web.subprocess, 'Popen', return_value=vite), \
                patch.object(web.threading, 'Thread'):
            with self.assertRaises(SystemExit) as error:
                web.main()
            self.assertEqual(error.exception.code, 1)
            worker.close.assert_called_once()


if __name__ == '__main__':
    unittest.main()
