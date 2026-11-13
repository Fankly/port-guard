#!/usr/bin/env python3
"""Prepare versioned desktop builds and collect GitHub Release installers."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil


ROOT = Path(__file__).resolve().parents[1]
NUMBER = r"(?:0|[1-9][0-9]*)"
IDENTIFIER = rf"(?:{NUMBER}|[0-9]*[A-Za-z-][0-9A-Za-z-]*)"
VERSION = re.compile(
    rf"{NUMBER}\.{NUMBER}\.{NUMBER}"
    rf"(?:-{IDENTIFIER}(?:\.{IDENTIFIER})*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
)
PLATFORMS = {
    "aarch64-apple-darwin": ("macos-arm64", "dmg", ".dmg"),
    "x86_64-apple-darwin": ("macos-x64", "dmg", ".dmg"),
    "x86_64-pc-windows-msvc": ("windows-x64", "nsis", ".exe"),
}


def parse_tag(tag):
    if not tag.startswith("v") or not VERSION.fullmatch(tag[1:]):
        raise ValueError("Expected a version tag such as v0.1.0 or v0.1.0-beta.1")
    return tag[1:]


def metadata(root, tag):
    version = parse_tag(tag) if tag else json.loads(
        (root / "src-tauri/tauri.conf.json").read_text(encoding="utf-8")
    )["version"]
    parse_tag("v" + version)
    return {
        "tag": tag,
        "version": version,
        "prerelease": str("-" in version.split("+", 1)[0]).lower(),
        "publish": str(bool(tag)).lower(),
    }


def prepare(root, version):
    parse_tag("v" + version)
    updates = {}
    for relative in (
        "package.json", "package-lock.json", "ui/package.json",
        "ui/package-lock.json", "src-tauri/tauri.conf.json",
    ):
        path = root / relative
        data = json.loads(path.read_text(encoding="utf-8"))
        data["version"] = version
        if relative.endswith("package-lock.json"):
            data["packages"][""]["version"] = version
        updates[path] = json.dumps(data, indent=2, ensure_ascii=False) + "\n"

    for relative in ("Cargo.toml", "src-tauri/Cargo.toml"):
        path = root / relative
        content, count = re.subn(
            r'(?ms)(^\[package\]\s*\n(?:(?!^\[).)*?^version\s*=\s*)"[^"]+"',
            lambda match: match[1] + '"' + version + '"',
            path.read_text(encoding="utf-8"),
        )
        if count != 1:
            raise ValueError(f"Expected one package version in {relative}")
        updates[path] = content

    lock = root / "Cargo.lock"
    content = lock.read_text(encoding="utf-8")
    for name in ("pf-probe", "port-guard-desktop"):
        content, count = re.subn(
            rf'(?m)(^\[\[package\]\]\nname = "{name}"\nversion = )"[^"]+"',
            lambda match: match[1] + '"' + version + '"', content,
        )
        if count != 1:
            raise ValueError(f"Expected one {name} package in Cargo.lock")
    updates[lock] = content
    for path, content in updates.items():
        path.write_text(content, encoding="utf-8")


def asset_name(version, target):
    platform, _, extension = PLATFORMS[target]
    return f"port-guard-{version}-{platform}{extension}"


def collect(root, version, target):
    parse_tag("v" + version)
    _, bundle, extension = PLATFORMS[target]
    source = root / "target" / target / "release/bundle" / bundle
    installers = sorted(source.glob("*" + extension))
    if len(installers) != 1 or installers[0].stat().st_size == 0:
        raise ValueError(f"Expected exactly one non-empty {extension} installer in {source}")
    output = root / "release-assets"
    output.mkdir(exist_ok=True)
    destination = output / asset_name(version, target)
    shutil.copy2(installers[0], destination)
    return destination


def checksums(root, version):
    parse_tag("v" + version)
    output = root / "release-assets"
    expected = {asset_name(version, target) for target in PLATFORMS}
    actual = {path.name for path in output.iterdir() if path.name != "SHA256SUMS"}
    if actual != expected:
        raise ValueError(f"Installer set is incomplete or unexpected: {sorted(actual)}")
    lines = []
    for name in sorted(expected):
        path = output / name
        if not path.is_file() or path.stat().st_size == 0:
            raise ValueError(f"Empty or invalid installer: {name}")
        digest = hashlib.sha256()
        with path.open("rb") as file:
            for chunk in iter(lambda: file.read(1024 * 1024), b""):
                digest.update(chunk)
        lines.append(f"{digest.hexdigest()}  {name}\n")
    (output / "SHA256SUMS").write_text("".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("metadata").add_argument("tag", nargs="?", default="")
    commands.add_parser("prepare").add_argument("version")
    collector = commands.add_parser("collect")
    collector.add_argument("version")
    collector.add_argument("target", choices=PLATFORMS)
    commands.add_parser("checksums").add_argument("version")
    args = parser.parse_args()
    if args.command == "metadata":
        for key, value in metadata(ROOT, args.tag).items():
            print(f"{key}={value}")
    elif args.command == "prepare":
        prepare(ROOT, args.version)
    elif args.command == "collect":
        print(collect(ROOT, args.version, args.target))
    else:
        checksums(ROOT, args.version)


if __name__ == "__main__":
    main()
