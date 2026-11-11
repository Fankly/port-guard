"""CLI regression tests use synthetic PFLOG bytes. They do not modify PF."""
import ipaddress
import json
import os
from pathlib import Path
import struct
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
config = json.loads((ROOT / '.local-toolchain.json').read_text()) if (ROOT / '.local-toolchain.json').exists() else {}
BIN = Path(os.environ.get('PF_PROBE_BIN', str(Path(config.get('target_dir', ROOT / 'target')) / 'debug/pf-probe')))


def synthetic_pflog(action):
    # Independently encode the published Darwin pfloghdr layout, then IPv4/UDP.
    header = struct.pack('BBBB16s16sIIIIII B 3x', 61, 2, action, 0,
                         b'en0', b'pf_probe', 7, 0, 0, 0, 0, 0, 1)
    assert len(header) == 64
    header = bytearray(header)
    header[36:44] = struct.pack('!II', 7, 0)  # PF stores rule numbers in network byte order.
    ip = struct.pack('!BBHHHBBH4s4s', 0x45, 0, 28, 0, 0, 64, 17, 0,
                     ipaddress.ip_address('192.0.2.20').packed,
                     ipaddress.ip_address('192.0.2.10').packed)
    return bytes(header) + ip + struct.pack('!HHHH', 42000, 18080, 8, 0)


class CliTests(unittest.TestCase):
    def run_cli(self, *args):
        return subprocess.run([str(BIN), *map(str, args)], capture_output=True, text=True, timeout=15)

    def test_kill_defaults_to_non_mutating_plan(self):
        r = self.run_cli('kill', '--source', '192.0.2.20', '--local', '192.0.2.10',
                         '--port', '18080', '--protocol', 'tcp', '--interface', 'en0')
        self.assertEqual(r.returncode, 0, r.stderr)
        result = json.loads(r.stdout)
        self.assertFalse(result['applied'])
        self.assertFalse(result['native_abi_runtime_verified'])
        self.assertEqual(len(bytes.fromhex(result['request_hex_inbound'])), 216)
        self.assertEqual(len(bytes.fromhex(result['request_hex_reverse'])), 216)
        self.assertIsNone(result['state_interface_filter'])

    def test_execute_requires_explicit_experimental_ack(self):
        r = self.run_cli('kill', '--source', '192.0.2.20', '--local', '192.0.2.10',
                         '--port', '18080', '--protocol', 'tcp', '--interface', 'en0', '--execute')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('--experimental-abi', r.stderr)

    def test_existing_output_is_never_overwritten(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / 'existing.conf'
            out.write_text('original')
            r = self.run_cli('render', '--policy', ROOT / 'examples/policy.json', '--out', out)
            self.assertNotEqual(r.returncode, 0)
            self.assertEqual(out.read_text(), 'original')

    def test_synthetic_capture_has_both_verdicts(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'synthetic.pcap'
            data = bytearray(struct.pack('<IHHIIII', 0xa1b2c3d4, 2, 4, 0, 0, 512, 117))
            for action in [0, 1]:
                packet = synthetic_pflog(action)
                data.extend(struct.pack('<IIII', 100, 250000, len(packet), len(packet)))
                data.extend(packet)
            p.write_bytes(data)
            r = self.run_cli('decode', '--pcap', p)
            self.assertEqual(r.returncode, 0, r.stderr)
            events = [json.loads(x) for x in r.stdout.splitlines()]
            self.assertEqual([e['action'] for e in events], ['allow', 'block'])
            self.assertTrue(all(e['destination_port'] == 18080 for e in events))
            self.assertEqual(json.loads(r.stderr)['events'], 2)

    def test_unknown_config_fields_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'bad.json'
            policy = json.loads((ROOT / 'examples/policy.json').read_text())
            policy['execute'] = True
            p.write_text(json.dumps(policy))
            r = self.run_cli('render', '--policy', p)
            self.assertNotEqual(r.returncode, 0)

    def test_capture_rejects_regular_network_device(self):
        r = self.run_cli('capture', '--interface', 'en0', '--port', '18080')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('pflog', r.stderr)


if __name__ == '__main__':
    unittest.main()
