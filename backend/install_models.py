#!/usr/bin/env python3
"""Bake offline Argos translation packages and Whisper speech model into the container."""
import os, urllib.request
from pathlib import Path
os.environ.setdefault("ARGOS_DEVICE_TYPE","cpu")
os.environ.setdefault("ARGOS_PACKAGES_DIR","/opt/argos/packages")
import argostranslate.package
from faster_whisper.utils import download_model
BASE="https://data.argosopentech.com/argospm/v1/"
PACKAGES=[
 "translate-en_vi-1_9.argosmodel","translate-ja_en-1_1.argosmodel",
 "translate-ko_en-1_1.argosmodel","translate-zh_en-1_9.argosmodel",
 "translate-es_en-1_0.argosmodel","translate-fr_en-1_9.argosmodel",
 "translate-de_en-1_9.argosmodel","translate-id_en-1_9.argosmodel",
 "translate-th_en-1_9.argosmodel"
]
def main():
    directory=Path("/tmp/argos-models"); directory.mkdir(parents=True,exist_ok=True)
    for name in PACKAGES:
        dest=directory/name
        if not dest.exists():
            request=urllib.request.Request(BASE+name,headers={"User-Agent":"Hendy-Vietsub-Offline-Builder/2.2"})
            print("Downloading "+name,flush=True)
            with urllib.request.urlopen(request,timeout=240) as response,dest.open("wb") as output:
                while True:
                    chunk=response.read(1024*1024)
                    if not chunk: break
                    output.write(chunk)
        print("Installing "+name,flush=True)
        argostranslate.package.install_from_path(str(dest))
    model_path=Path(os.environ.get("WHISPER_MODEL_PATH","/opt/models/whisper-tiny"))
    model_path.parent.mkdir(parents=True,exist_ok=True)
    print("Downloading multilingual Whisper tiny model",flush=True)
    download_model("tiny",output_dir=str(model_path))
    print("Offline models installed.",flush=True)
if __name__=="__main__": main()
