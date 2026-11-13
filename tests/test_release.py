import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("release", ROOT / "tools/release.py")
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def test_tags_and_prerelease_classification(self):
        for tag in ("v0.1.0", "v1.2.3-beta.1", "v1.2.3+build-4"):
            with self.subTest(tag=tag):
                self.assertEqual(release.parse_tag(tag), tag[1:])
        for tag in ("1.2.3", "v1.2", "v01.2.3", "v1.2.3-beta.01", "v1.2.3\n", "v1.2.3;echo x"):
            with self.subTest(tag=tag), self.assertRaises(ValueError):
                release.parse_tag(tag)
        self.assertEqual(release.metadata(ROOT, "v1.2.3-beta.1")["prerelease"], "true")
        self.assertEqual(release.metadata(ROOT, "v1.2.3+build-4")["prerelease"], "false")
        self.assertEqual(release.metadata(ROOT, "")["publish"], "false")

    def test_prepare_updates_real_manifests_and_preserves_dependencies(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = (
                "package.json", "package-lock.json", "ui/package.json",
                "ui/package-lock.json", "src-tauri/tauri.conf.json",
                "Cargo.toml", "src-tauri/Cargo.toml", "Cargo.lock",
            )
            for relative in paths:
                target = root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(ROOT / relative, target)
            original_lock = (root / "Cargo.lock").read_text(encoding="utf-8")
            release.prepare(root, "1.2.3-beta.1")
            for relative in paths[:5]:
                data = json.loads((root / relative).read_text(encoding="utf-8"))
                self.assertEqual(data["version"], "1.2.3-beta.1")
                if relative.endswith("package-lock.json"):
                    self.assertEqual(data["packages"][""]["version"], "1.2.3-beta.1")
            for relative in paths[5:7]:
                self.assertIn('version = "1.2.3-beta.1"', (root / relative).read_text(encoding="utf-8"))
            updated_lock = (root / "Cargo.lock").read_text(encoding="utf-8")
            self.assertEqual(updated_lock.count('version = "1.2.3-beta.1"'), 2)
            # Reverting the two application versions reproduces the original
            # lockfile: dependency versions and checksums must stay untouched.
            previous = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
            self.assertEqual(updated_lock.replace('version = "1.2.3-beta.1"', f'version = "{previous}"'), original_lock)

    def test_collect_requires_installer_and_checksums_require_every_platform(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaises(ValueError):
                release.collect(root, "1.2.3", "aarch64-apple-darwin")
            for target, (_, bundle, extension) in release.PLATFORMS.items():
                source = root / "target" / target / "release/bundle" / bundle
                source.mkdir(parents=True)
                installer = source / ("installer" + extension)
                installer.write_bytes(target.encode())
                release.collect(root, "1.2.3", target)
                if target == "aarch64-apple-darwin":
                    with self.assertRaises(ValueError):
                        release.checksums(root, "1.2.3")
            release.checksums(root, "1.2.3")
            sums = (root / "release-assets/SHA256SUMS").read_text(encoding="utf-8")
            self.assertEqual(len(sums.splitlines()), 3)
            for target in release.PLATFORMS:
                self.assertIn(f"{hashlib.sha256(target.encode()).hexdigest()}  {release.asset_name('1.2.3', target)}", sums)
            # An unexpected file must not silently become a public release asset.
            (root / "release-assets/debug.log").write_text("debug", encoding="utf-8")
            with self.assertRaises(ValueError):
                release.checksums(root, "1.2.3")


if __name__ == "__main__":
    unittest.main()
