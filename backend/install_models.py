#!/usr/bin/env python3
"""Bake verified offline Argos translation packages and Whisper tiny into a container image."""
import os
import urllib.request
import zipfile
from pathlib import Path

os.environ.setdefault("ARGOS_DEVICE_TYPE", "cpu")
os.environ.setdefault("ARGOS_PACKAGES_DIR", "/opt/argos/packages")
import argostranslate.package
from faster_whisper.utils import download_model

BASE = "https://argos-net.com/v1/"
PACKAGES = [
    "translate-en_vi-1_9.argosmodel",
    "translate-ja_en-1_1.argosmodel",
    "translate-ko_en-1_1.argosmodel",
    "translate-zh_en-1_9.argosmodel",
    "translate-fr_en-1_9.argosmodel",
    "translate-de_en-1_3.argosmodel",
    "translate-id_en-1_9.argosmodel",
    "translate-it_en-1_0.argosmodel",
    "translate-fi_en-1_9.argosmodel",
    "translate-hi_en-1_1.argosmodel",
]


def download_package(name: str, directory: Path) -> Path:
    destination = directory / name
    if destination.exists() and zipfile.is_zipfile(destination):
        return destination

    partial = directory / (name + ".part")
    partial.unlink(missing_ok=True)
    request = urllib.request.Request(
        BASE + name,
        headers={"User-Agent": "Hendy-VietSub-Offline-Builder/2.2.1"},
    )
    print("Downloading " + BASE + name, flush=True)
    try:
        with urllib.request.urlopen(request, timeout=240) as response, partial.open("wb") as output:
            if getattr(response, "status", 200) != 200:
                raise RuntimeError("Model download returned HTTP " + str(response.status))
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)
        if not zipfile.is_zipfile(partial):
            raise RuntimeError("Downloaded model is not a valid Argos model archive: " + name)
        partial.replace(destination)
    except Exception:
        partial.unlink(missing_ok=True)
        raise
    return destination


def main() -> None:
    package_dir = Path("/tmp/argos-models")
    package_dir.mkdir(parents=True, exist_ok=True)
    for name in PACKAGES:
        package_path = download_package(name, package_dir)
        print("Installing " + name, flush=True)
        argostranslate.package.install_from_path(str(package_path))

    model_path = Path(os.environ.get("WHISPER_MODEL_PATH", "/opt/models/whisper-tiny"))
    model_path.parent.mkdir(parents=True, exist_ok=True)
    if not (model_path / "model.bin").is_file():
        print("Downloading multilingual Whisper tiny model", flush=True)
        download_model("tiny", output_dir=str(model_path))
    if not (model_path / "model.bin").is_file():
        raise RuntimeError("Whisper tiny download completed without model.bin; refusing to publish an incomplete image.")

    installed = {language.code for language in __import__("argostranslate.translate", fromlist=["get_installed_languages"]).get_installed_languages()}
    if not {"en", "vi", "ja", "ko", "zh", "fr", "de", "id", "it", "fi", "hi"}.issubset(installed):
        raise RuntimeError("The installed Argos language models do not match the release manifest: " + ", ".join(sorted(installed)))
    print("Offline models installed and verified.", flush=True)


if __name__ == "__main__":
    main()
