#!/usr/bin/env python3
import json, os, re, sys
from functools import lru_cache

os.environ.setdefault("ARGOS_DEVICE_TYPE", "cpu")
os.environ.setdefault("OMP_NUM_THREADS", "2")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

try:
    import argostranslate.translate as argos_translate
    from langdetect import DetectorFactory, detect
    DetectorFactory.seed = 0
except ImportError:
    print(json.dumps({"type": "startup_error", "error": "Missing dependencies (argostranslate, langdetect)."}), flush=True)
    sys.exit(1)

SUPPORTED = {"en", "ja", "ko", "zh", "fr", "de", "id", "it", "fi", "hi"}
MODEL_PATH = os.environ.get("WHISPER_MODEL_PATH", "/opt/models/whisper-tiny")

def normalize(code):
    code = (code or "").strip().lower().replace("_", "-")
    if code in ("zh-cn", "zh-tw", "zh-hans", "zh-hant", "zt"): return "zh"
    return code.split("-")[0]

def detect_language(text):
    if re.search(r"[\u3040-\u30ff]", text): return "ja"
    if re.search(r"[\uac00-\ud7af]", text): return "ko"
    if re.search(r"[\u4e00-\u9fff]", text): return "zh"
    try:
        code = normalize(detect(text))
    except Exception:
        return "en" if text.isascii() else "auto"
    
    if code in SUPPORTED: return code
    return "en" if len(text) <= 14 and text.isascii() else code

def translate_text(text, source, target="vi"):
    text = str(text or "").strip()
    if not text: return text, normalize(source or "en")
    
    source = normalize(source)
    if source in ("", "auto"):
        source = detect_language(text)
        
    if source == target: return text, source
    if source not in SUPPORTED:
        raise ValueError(f"Chưa có gói dịch offline từ ngôn ngữ '{source}'.")
    
    try:
        translated = argos_translate.translate(text, source, target)
        if not isinstance(translated, str) or not translated.strip():
            raise ValueError("Mô hình Argos offline trả về rỗng.")
        return translated.strip(), source
    except Exception as e:
        raise ValueError(f"Lỗi dịch Argos: {str(e)}")

@lru_cache(maxsize=1)
def whisper_model():
    if not os.path.isfile(os.path.join(MODEL_PATH, "model.bin")):
        raise RuntimeError("Không tìm thấy mô hình Whisper tiny.")
    from faster_whisper import WhisperModel
    return WhisperModel(MODEL_PATH, device="cpu", compute_type="int8", cpu_threads=int(os.environ.get("OMP_NUM_THREADS", "2")))

def pre_warm_models():
    # Khởi động Whisper vào RAM trước thay vì đợi request đầu tiên để tránh Timeout.
    try:
        whisper_model()
    except Exception as e:
        pass # Bỏ qua nếu model không tồn tại để báo trạng thái cụ thể về Node.js

def transcribe(path, language):
    if not os.path.isfile(path): raise ValueError("Không tìm thấy video tạm để nhận dạng.")
    opts = {"beam_size": 3, "vad_filter": True, "condition_on_previous_text": False}
    if language and language != "auto": opts["language"] = normalize(language)
    
    segments, info = whisper_model().transcribe(path, **opts)
    result = []
    for seg in segments:
        line = str(seg.text or "").strip()
        if line and float(seg.end) > float(seg.start):
            result.append({"start": float(seg.start), "end": float(seg.end), "text": line})
        if len(result) >= 10000: break
            
    return {
        "segments": result,
        "language": getattr(info, "language", language or "auto"),
        "languageProbability": float(getattr(info, "language_probability", 0.0) or 0.0),
    }

def handle(req):
    op = req.get("op")
    if op == "translate":
        texts, source, target = req.get("texts", []), str(req.get("source", "auto")), str(req.get("target", "vi"))
        if target != "vi": raise ValueError("Chỉ xuất Vietsub tiếng Việt (vi).")
        translations, detected = [], []
        for item in texts:
            t, l = translate_text(item, source, target)
            translations.append(t)
            detected.append(l)
        return {"translations": translations, "detectedLanguages": detected}
    
    if op == "transcribe":
        return transcribe(str(req.get("path", "")), str(req.get("language", "auto")))
        
    raise ValueError("Lệnh không hợp lệ.")

try:
    pre_warm_models()
    languages = {lang.code for lang in argos_translate.get_installed_languages()}
    if not {"en", "vi"}.issubset(languages):
        raise RuntimeError("Thiếu mô hình Argos EN -> VI.")
        
    print(json.dumps({
        "type": "ready",
        "translationLanguages": sorted(SUPPORTED | {"vi"}),
        "whisperModelAvailable": os.path.isfile(os.path.join(MODEL_PATH, "model.bin")),
    }, ensure_ascii=False), flush=True)
except Exception as exc:
    print(json.dumps({"type": "startup_error", "error": str(exc)}, ensure_ascii=False), flush=True)

# Main IPC loop
for raw in sys.stdin:
    if not raw.strip(): continue
    req = {}
    try:
        req = json.loads(raw)
        response = {"id": req.get("id"), "ok": True, "result": handle(req)}
    except json.JSONDecodeError:
        continue # Bỏ qua JSON rác
    except Exception as exc:
        response = {"id": req.get("id"), "ok": False, "error": str(exc)[:1000]}
    
    print(json.dumps(response, ensure_ascii=False), flush=True)
