"""Loopback test checks the test fixture itself, not the firewall."""
import json
from pathlib import Path
import select
import socket
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]


def free_port(kind):
    with socket.socket(socket.AF_INET, kind) as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


class FixtureTests(unittest.TestCase):
    def test_two_tcp_streams_and_one_way_udp(self):
        protected = free_port(socket.SOCK_STREAM)
        control = free_port(socket.SOCK_STREAM)
        while control == protected:
            control = free_port(socket.SOCK_STREAM)
        udp = free_port(socket.SOCK_DGRAM)
        common = ['--protected', str(protected), '--control', str(control), '--udp', str(udp)]
        server = subprocess.Popen([sys.executable, str(ROOT / 'tools/traffic_lab.py'), 'server',
                                   '--bind', '127.0.0.1', '--seconds', '15', *common],
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        try:
            ready, _, _ = select.select([server.stdout], [], [], 8)
            self.assertTrue(ready, 'test server did not start')
            self.assertEqual(json.loads(server.stdout.readline())['kind'], 'ready')
            observer = subprocess.run([sys.executable, str(ROOT / 'tools/traffic_lab.py'), 'observe',
                                       '--host', '127.0.0.1', '--seconds', '2', *common],
                                      capture_output=True, text=True, timeout=8)
            self.assertEqual(observer.returncode, 0, observer.stderr)
            last = json.loads(observer.stdout.splitlines()[-1])
            self.assertTrue(all(n > 0 for n in last['received_total'].values()), last)
            self.assertFalse(last['firewall_verdict_inferred'])
        finally:
            server.terminate()
            server.communicate(timeout=5)


if __name__ == '__main__':
    unittest.main()
