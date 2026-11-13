#!/usr/bin/env python3
"""Serve the browser UI and real Rust/SQLite commands on loopback only.

python3 tools/web.py                 # serve ui/dist and API at :1422
python3 tools/web.py --api-only      # API at :1421 for the Vite dev proxy
python3 tools/web.py --dev           # API at :1421 and Vite UI at :1420
Use --database to isolate a test. By default this shares the desktop database.
"""
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading

ROOT = Path(__file__).resolve().parents[1]
MAX_BODY = 1024 * 1024
COMMANDS = {'load_state', 'save_state', 'reset_state', 'preview_policy', 'app_info', 'read_system_rules', 'read_access_logs'}


def database_path():
    if sys.platform == 'win32':
        directory = Path(os.environ['APPDATA'])
    elif sys.platform == 'darwin':
        directory = Path.home() / 'Library/Application Support'
    else:
        directory = Path(os.environ.get('XDG_DATA_HOME', Path.home() / '.local/share'))
    return directory / 'dev.portguard.desktop/port-guard.sqlite3'


class Worker:
    def __init__(self, database):
        self.lock = threading.Lock()
        self.process = subprocess.Popen(
            [sys.executable, str(ROOT / 'tools/dev.py'), 'run', '-p',
             'port-guard-desktop', '--bin', 'port-guard-web', '--', str(database)],
            cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            text=True, encoding='utf-8', bufsize=1,
        )
        if self.process.stdout.readline().strip() != '{"ready":true}':
            self.close()
            raise RuntimeError('Rust backend failed to start; inspect the Cargo output above')

    def invoke(self, command, args):
        with self.lock:
            if self.process.poll() is not None:
                raise RuntimeError('Rust backend is not running')
            self.process.stdin.write(json.dumps({'command': command, 'args': args}) + '\n')
            self.process.stdin.flush()
            response = self.process.stdout.readline()
            if not response:
                raise RuntimeError('Rust backend disconnected')
            return json.loads(response)

    def close(self):
        if self.process.stdin:
            self.process.stdin.close()
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.terminate()
            self.process.wait(timeout=5)


class Handler(SimpleHTTPRequestHandler):
    def reply(self, status, body):
        encoded = json.dumps(body, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(encoded)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(encoded)

    def trusted(self):
        # Exact host/origin checks prevent DNS rebinding and cross-site writes.
        if self.headers.get('Host') not in self.server.allowed_hosts:
            self.reply(403, {'error': 'Host not allowed'})
            return False
        origin = self.headers.get('Origin')
        if origin is not None and origin not in self.server.allowed_origins:
            self.reply(403, {'error': 'Origin not allowed'})
            return False
        return True

    def do_POST(self):
        if not self.trusted():
            return
        command = self.path.removeprefix('/api/') if self.path.startswith('/api/') else ''
        if command not in COMMANDS:
            return self.reply(404, {'error': 'Unknown command'})
        if self.headers.get_content_type() != 'application/json':
            return self.reply(415, {'error': 'Expected application/json'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1 or length > MAX_BODY:
                return self.reply(413, {'error': 'Request size must be 1..1048576 bytes'})
            self.connection.settimeout(10)
            args = json.loads(self.rfile.read(length))
            if not isinstance(args, dict):
                raise ValueError('Request must be a JSON object')
        except (ValueError, OSError) as error:
            return self.reply(400, {'error': str(error)})
        try:
            result = self.server.worker.invoke(command, args)
            self.reply(200 if result['ok'] else 422, result)
        except (OSError, RuntimeError, ValueError) as error:
            self.reply(503, {'error': str(error)})

    def do_GET(self):
        if not self.trusted():
            return
        if self.path.startswith('/api/') or self.server.api_only:
            return self.reply(404, {'error': 'Use POST /api/<command>'})
        super().do_GET()

    def do_HEAD(self):
        if self.trusted():
            super().do_HEAD()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', type=Path, default=database_path())
    parser.add_argument('--port', type=int)
    parser.add_argument('--api-only', action='store_true')
    parser.add_argument('--dev', action='store_true', help='Start the API and Vite together')
    options = parser.parse_args()
    api_only = options.api_only or options.dev
    port = options.port or (1421 if api_only else 1422)
    if options.dev and port != 1421:
        parser.error('--dev uses API port 1421, matching the Vite proxy')
    if options.dev and not shutil.which('npm'):
        parser.error('Install Node.js 20.19+ and npm first')
    if not api_only and not (ROOT / 'ui/dist/index.html').exists():
        parser.error('Build the UI first: npm --prefix ui run build')
    worker = Worker(options.database.resolve())
    vite = None
    try:
        server = ThreadingHTTPServer(('127.0.0.1', port), functools.partial(Handler, directory=str(ROOT / 'ui/dist')))
        server.worker = worker
        server.api_only = api_only
        server.allowed_hosts = {f'{host}:{port}' for host in ('localhost', '127.0.0.1')}
        server.allowed_origins = {f'http://{host}:{value}' for host in ('localhost', '127.0.0.1') for value in (port, 1420)}
        print(f'Browser backend: http://127.0.0.1:{port}', flush=True)
        print(f'SQLite: {options.database}', flush=True)
        try:
            if options.dev:
                vite = subprocess.Popen([shutil.which('npm'), '--prefix', str(ROOT / 'ui'), 'run', 'dev:ui'], cwd=ROOT)
                def watch_vite():
                    vite.wait()
                    server.shutdown()
                threading.Thread(target=watch_vite, daemon=True).start()
                print('Browser UI: http://127.0.0.1:1420', flush=True)
            server.serve_forever()
        except KeyboardInterrupt:
            pass
        finally:
            server.server_close()
    finally:
        if vite is not None and vite.poll() is None:
            vite.terminate()
            try:
                vite.wait(timeout=5)
            except subprocess.TimeoutExpired:
                vite.kill()
                vite.wait(timeout=5)
        worker.close()
    if vite is not None and vite.returncode not in (None, 0, -15):
        raise SystemExit(vite.returncode)


if __name__ == '__main__':
    main()
