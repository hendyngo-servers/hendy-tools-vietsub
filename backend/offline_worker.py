#!/usr/bin/env python3
import json, os, re, sys
from functools import lru_cache

os.environ.setdefault("ARGOS_DEVICE_TYPE", "cpu")
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

import argostranslate.translate as argos_translate
from langdetect import DetectorFactory, detect
DetectorFactory.seed = 0

SUPPORTED = {"en", "ja", "ko", "zh", "fr", "de", "id", "it", "fi", "hi"}
MODEL_PATH = os.environ.get("WHISPER_MODEL_PATH", "/opt/models/whisper-tiny")


def normalize(code):
    code = (code or "").strip().lower().replace("_", "-")
    if code in ("zh-cn", "zh-tw", "zh-hans", "zh-hant", "zt"):
        return "zh"
    return code.split("-")[0]


def detect_language(text):
    if re.search(r"[\u3040-\u30ff]", text):
        return "ja"
    if re.search(r"[\uac00-\ud7af]", text):
        return "ko"
    if re.search(r"[\u4e00-\u9fff]", text):
        return "zh"
    try:
        code = normalize(detect(text))
    except Exception:
        if text.isascii():
            return "en"
        raise ValueError("Không nhận diện được ngôn ngữ nguồn; hãy chọn thủ công.")
    if code in SUPPORTED:
        return code
    if len(text) <= 14 and text.isascii():
        return "en"
    raise ValueError("Ngôn ngữ '" + code + "' chưa có gói dịch offline trong bản phát hành này.")


def translate_text(text, source, target="vi"):
    text = str(text or "").strip()
    if not text:
        return text, normalize(source or "en")
    source = normalize(source)
    if source in ("", "auto"):
        source = detect_language(text)
    if source == target:
        return text, source
    if source not in SUPPORTED:
        raise ValueError("Chưa có gói dịch offline từ ngôn ngữ '" + source + "' sang tiếng Việt.")
    # Argos Translate automatically pivots through installed intermediate languages.
    # This release bundles source→English packages plus English→Vietnamese.
    translated = argos_translate.translate(text, source, target)
    if not isinstance(translated, str) or not translated.strip():
        raise ValueError("Mô hình Argos offline không trả về bản dịch.")
    return translated.strip(), source


@lru_cache(maxsize=1)
def whisper_model():
    if not os.path.isfile(os.path.join(MODEL_PATH, "model.bin")):
        raise RuntimeError("Không tìm thấy mô hình Whisper tiny cục bộ.")
    from faster_whisper import WhisperModel
    return WhisperModel(
        MODEL_PATH,
        device="cpu",
        compute_type="int8",
        cpu_threads=int(os.environ.get("OMP_NUM_THREADS", "2")),
    )


def transcribe(path, language):
    if not os.path.isfile(path):
        raise ValueError("Không tìm thấy video tạm để nhận dạng.")
    opts = {"beam_size": 3, "vad_filter": True, "condition_on_previous_text": False, "word_timestamps": False}
    language = normalize(language)
    if language and language != "auto":
        opts["language"] = language
    segments, info = whisper_model().transcribe(path, **opts)
    result = []
    for seg in segments:
        line = str(seg.text or "").strip()
        if line and float(seg.end) > float(seg.start):
            result.append({"start": float(seg.start), "end": float(seg.end), "text": line})
        if len(result) >= 10000:
            break
    return {
        "segments": result,
        "language": getattr(info, "language", language or "auto"),
        "languageProbability": float(getattr(info, "language_probability", 0.0) or 0.0),
    }


def handle(req):
    op = req.get("op")
    if op == "translate":
        texts = req.get("texts")
        source = str(req.get("source", "auto"))
        target = str(req.get("target", "vi"))
        if target != "vi":
            raise ValueError("Bộ dịch offline chỉ xuất Vietsub tiếng Việt (vi).")
        if not isinstance(texts, list) or not 1 <= len(texts) <= 40:
            raise ValueError("Mỗi nhóm dịch cần từ 1 đến 40 câu.")
        translations, detected = [], []
        for item in texts:
            if not isinstance(item, str) or not item.strip() or len(item) > 5000:
                raise ValueError("Câu đầu vào không hợp lệ hoặc dài quá 5000 ký tự.")
            translated, lang = translate_text(item, source, target)
            translations.append(translated)
            detected.append(lang)
        return {"translations": translations, "detectedLanguages": detected}
    if op == "transcribe":
        return transcribe(str(req.get("path", "")), str(req.get("language", "auto")))
    raise ValueError("Không biết loại tác vụ offline.")


try:
    languages = {lang.code for lang in argos_translate.get_installed_languages()}
    if not {"en", "vi"}.issubset(languages):
        raise RuntimeError("Không tìm thấy mô hình Argos tiếng Anh → tiếng Việt.")
    missing = SUPPORTED - languages
    if missing:
        raise RuntimeError("Thiếu các gói ngôn ngữ: " + ", ".join(sorted(missing)))
    print(json.dumps({
        "type": "ready",
        "translationLanguages": sorted(SUPPORTED | {"vi"}),
        "whisperModelAvailable": os.path.isfile(os.path.join(MODEL_PATH, "model.bin")),
    }, ensure_ascii=False), flush=True)
except Exception as exc:
    print(json.dumps({
        "type": "startup_error",
        "error": str(exc),
        "translationLanguages": [],
        "whisperModelAvailable": os.path.isfile(os.path.join(MODEL_PATH, "model.bin")),
    }, ensure_ascii=False), flush=True)


for raw in sys.stdin:
    if not raw.strip():
        continue
    req = {}
    try:
        req = json.loads(raw)
        response = {"id": req.get("id"), "ok": True, "result": handle(req)}
    except Exception as exc:
        response = {"id": req.get("id"), "ok": False, "error": str(exc)[:1000]}
    print(json.dumps(response, ensure_ascii=False), flush=True)
