#!/usr/bin/env python3
"""Run Cargo with either a system toolchain or a workspace-local installation."""
import json
import os
from pathlib import Path
import shutil
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
    env['CARGO_HOME'] = os.environ.get('CARGO_HOME', str(toolchain_root / 'cargo'))
    env['RUSTUP_HOME'] = str(toolchain_root / 'rustup')
    env['RUSTUP_TOOLCHAIN'] = candidates[0].name
    exe = '.exe' if os.name == 'nt' else ''
    env['RUSTC'] = str(candidates[0] / 'bin' / f'rustc{exe}')
    env['RUSTDOC'] = str(candidates[0] / 'bin' / f'rustdoc{exe}')
    env['PATH'] = str(candidates[0] / 'bin') + os.pathsep + env.get('PATH', '')
    cargo = str(candidates[0] / 'bin/cargo')
else:
    cargo = shutil.which('cargo')
    if not cargo:
        raise SystemExit('Install Rust, or set PORT_GUARD_TOOLCHAIN to a local rustup directory')
if config.get('target_dir'):
    env['CARGO_TARGET_DIR'] = os.environ.get('CARGO_TARGET_DIR', config['target_dir'])
if len(sys.argv) < 2:
    raise SystemExit('Usage: python3 tools/dev.py test | build | run -- <pf-probe arguments>')
raise SystemExit(subprocess.run([cargo, *sys.argv[1:]], cwd=root, env=env).returncode)
