#!/usr/bin/env python3
"""Run the Tauri CLI with the workspace-local Rust toolchain.

Node.js (>= 20.19) and the dependencies from `npm install` are still required.
Usage:
    python3 tools/desktop.py dev
    python3 tools/desktop.py build --no-bundle
    python3 tools/desktop.py build
"""
import json
import os
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
config_path = root / '.local-toolchain.json'
config = json.loads(config_path.read_text()) if config_path.exists() else {}
env = os.environ.copy()
toolchain_root = os.environ.get('PORT_GUARD_TOOLCHAIN', config.get('root'))
if toolchain_root:
    toolchain_root = Path(toolchain_root)
    candidates = sorted((toolchain_root / 'rustup/toolchains').glob('stable-*'))
    if len(candidates) != 1:
        raise SystemExit('Expected one stable local Rust toolchain')
    env['CARGO_HOME'] = str(toolchain_root / 'cargo')
    env['RUSTUP_HOME'] = str(toolchain_root / 'rustup')
    env['RUSTUP_TOOLCHAIN'] = candidates[0].name
    env['RUSTC'] = str(candidates[0] / 'bin/rustc')
    env['RUSTDOC'] = str(candidates[0] / 'bin/rustdoc')
    env['PATH'] = str(candidates[0] / 'bin') + os.pathsep + env.get('PATH', '')
if config.get('target_dir'):
    env['CARGO_TARGET_DIR'] = config['target_dir']

tauri = root / 'node_modules/.bin/tauri'
if not tauri.exists():
    raise SystemExit('Install the desktop dependencies first: npm install')
if len(sys.argv) < 2:
    raise SystemExit('Usage: python3 tools/desktop.py dev | build [--no-bundle] | icon <source.png>')
raise SystemExit(subprocess.run([str(tauri), *sys.argv[1:]], cwd=root, env=env).returncode)
