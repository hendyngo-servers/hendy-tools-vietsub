'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = Number(process.env.PORT || 10000);
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MAX_SUBTITLE_BYTES = 350 * 1024;
const MAX_VIDEO_SECONDS = 10 * 60;
const FFMPEG_TIMEOUT_MS = 240_000;
const WORKER_TIMEOUT_MS = 12 * 60_000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS ||
  'https://hendyngo-servers.github.io,https://hendy-tools-vietsub.ngogiaidy3.workers.dev,http://localhost:8080,http://127.0.0.1:8080')
  .split(',').map(v => v.trim()).filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by ALLOWED_ORIGINS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  maxAge: 600
}));
app.use(express.json({ limit: '512kb' }));

const translateLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false });
const mediaLimiter = rateLimit({ 
  windowMs: 15 * 60_000, limit: 3, standardHeaders: 'draft-8', legacyHeaders: false, 
  message: { error: 'Đã đạt giới hạn xử lý media tạm thời. Hãy thử lại sau.' } 
});
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1, fields: 4, fieldSize: MAX_SUBTITLE_BYTES }
});

let worker;
let workerReady = false;
let workerStartupError = "";
let workerInfo = { translationLanguages: [], whisperModelAvailable: false };
let workerCounter = 0;
let workerBuffer = '';
const pendingWorkerRequests = new Map();
const workerPath = path.join(__dirname, 'offline_worker.py');
const pythonBin = process.env.PYTHON_BIN || 'python3';

// Đã tách hàm spawn worker để hỗ trợ tự động restart
function spawnWorker() {
  workerReady = false;
  workerBuffer = '';
  worker = spawn(pythonBin, [workerPath], { stdio: ['pipe', 'pipe', 'pipe'], env: process.env });

  worker.stdout.setEncoding('utf8');
  worker.stdout.on('data', (chunk) => {
    workerBuffer += chunk;
    let newline;
    while ((newline = workerBuffer.indexOf('\n')) >= 0) {
      const line = workerBuffer.slice(0, newline);
      workerBuffer = workerBuffer.slice(newline + 1);
      if (!line.trim()) continue;
      let message;
      try { message = JSON.parse(line); } catch (_) { continue; }
      
      if (message.type === 'startup_error') {
        workerReady = false;
        workerStartupError = String(message.error || 'Lỗi khởi động mô hình.').slice(0, 500);
        console.error('[Worker Error]', workerStartupError);
        continue;
      }
      if (message.type === 'ready') {
        workerInfo = {
          translationLanguages: Array.isArray(message.translationLanguages) ? message.translationLanguages : [],
          whisperModelAvailable: Boolean(message.whisperModelAvailable)
        };
        workerReady = workerInfo.translationLanguages.includes('vi') && workerInfo.translationLanguages.includes('en');
        workerStartupError = workerReady ? '' : 'Bộ mô hình dịch không đầy đủ.';
        console.log('[Worker Ready] Languages:', workerInfo.translationLanguages.join(', '));
        continue;
      }
      
      const pending = pendingWorkerRequests.get(String(message.id));
      if (!pending) continue;
      pendingWorkerRequests.delete(String(message.id));
      clearTimeout(pending.timer);
      if (message.ok) pending.resolve(message.result);
      else pending.reject(new Error(message.error || 'Offline model failed.'));
    }
  });

  worker.stderr.setEncoding('utf8');
  worker.stderr.on('data', (chunk) => {
    const line = chunk.trim();
    if (line) console.error('[Python Log]', line.slice(0, 500));
  });

  worker.on('error', (error) => {
    console.error('Failed to start worker process:', error.message);
    resetPendingRequests('Không thể khởi động bộ máy offline.');
  });

  worker.on('exit', (code) => {
    console.error(`Worker exited with code ${code}. Restarting in 3 seconds...`);
    resetPendingRequests('Bộ máy Vietsub cục bộ đã dừng đột ngột.');
    setTimeout(spawnWorker, 3000); // Auto-heal
  });
}

function resetPendingRequests(reasonMsg) {
  workerReady = false;
  const reason = new Error(reasonMsg);
  for (const pending of pendingWorkerRequests.values()) {
    clearTimeout(pending.timer);
    pending.reject(reason);
  }
  pendingWorkerRequests.clear();
}

spawnWorker();

function callWorker(payload, timeoutMs = WORKER_TIMEOUT_MS) {
  if (!workerReady) return Promise.reject(new Error('Bộ máy đang khởi động hoặc đang bận. Vui lòng thử lại sau.'));
  
  return new Promise((resolve, reject) => {
    const id = String(++workerCounter);
    const timer = setTimeout(() => {
      pendingWorkerRequests.delete(id);
      reject(new Error('Tác vụ offline vượt quá thời gian cho phép.'));
    }, timeoutMs);
    pendingWorkerRequests.set(id, { resolve, reject, timer });
    
    try {
      worker.stdin.write(JSON.stringify({ ...payload, id }) + '\n', (error) => {
        if (error) {
          pendingWorkerRequests.delete(id);
          clearTimeout(timer);
          reject(new Error('Không gửi được tác vụ đến tiến trình offline.'));
        }
      });
    } catch (_) {
      pendingWorkerRequests.delete(id);
      clearTimeout(timer);
      reject(new Error('Lỗi giao tiếp với tiến trình offline.'));
    }
  });
}

function run(command, args, timeoutMs, captureOutput = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : 'ignore' });
    let stdout = '', stderr = '';
    let settled = false;
    
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(new Error('Quá thời gian xử lý video.'));
    }, timeoutMs);

    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(result);
    }

    if (captureOutput) {
      child.stdout.on('data', (chunk) => stdout += chunk.toString());
      child.stderr.on('data', (chunk) => { if (stderr.length < 8000) stderr += chunk.toString(); });
    }
    
    child.once('error', () => finish(new Error('Không chạy được FFmpeg. Kiểm tra lại môi trường cài đặt.')));
    child.once('close', (code) => {
      if (code !== 0) return finish(new Error(captureOutput ? 'Không đọc được metadata video.' : 'FFmpeg lỗi khi ghép phụ đề.'));
      finish(null, { stdout, stderr });
    });
  });
}

async function inspectVideo(file) {
  const probe = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration:stream=codec_type', '-of', 'json', file
  ], 20_000, true);
  
  let metadata;
  try { metadata = JSON.parse(probe.stdout); } catch (_) { metadata = null; }
  const duration = Number(metadata?.format?.duration);
  const hasVideo = metadata?.streams?.some(s => s.codec_type === 'video');
  
  if (!hasVideo || !Number.isFinite(duration) || duration <= 0) throw new Error('Tệp tải lên không có video hợp lệ.');
  if (duration > MAX_VIDEO_SECONDS) {
    const error = new Error('Bản cấu hình mặc định giới hạn video tối đa 10 phút.');
    error.statusCode = 413;
    throw error;
  }
  return { duration, streams: metadata.streams };
}

const safeRemove = async (filePath) => fs.rm(filePath, { force: true, recursive: true }).catch(() => {});

function uploadVideo(req, res, next) {
  upload.single('video')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Video vượt quá giới hạn 200 MB.' : 'Lỗi tải tệp.' });
    }
    return next(error);
  });
}

app.get('/health', (_req, res) => {
  res.status(workerReady ? 200 : 503).json({
    ok: workerReady,
    status: workerReady ? 'ready' : 'starting_or_failed',
    offlineEngineReady: workerReady,
    offlineTranslation: workerReady && workerInfo.translationLanguages.length > 0,
    speechRecognition: workerReady && workerInfo.whisperModelAvailable,
    videoRendering: true,
    translationLanguages: workerInfo.translationLanguages,
    maxVideoBytes: MAX_VIDEO_BYTES,
    workerError: workerStartupError || undefined
  });
});

app.post('/api/translate-batch', translateLimiter, async (req, res) => {
  const texts = Array.isArray(req.body?.texts) ? req.body.texts : (req.body?.q ? [req.body.q] : []);
  if (!texts.length || texts.length > 40 || texts.some(t => typeof t !== 'string' || !t.trim() || t.length > 5000)) {
    return res.status(400).json({ error: 'Gửi từ 1 đến 40 câu; mỗi câu tối đa 5000 ký tự hợp lệ.' });
  }
  
  if (req.body?.target && req.body.target !== 'vi') return res.status(400).json({ error: 'Chỉ hỗ trợ target=vi.' });
  
  try {
    const result = await callWorker({ op: 'translate', texts, source: req.body?.source || 'auto', target: 'vi' }, 180_000);
    return res.json({ translations: result.translations, detectedLanguages: result.detectedLanguages || [] });
  } catch (error) {
    return res.status(/không có mô hình/i.test(error.message) ? 422 : 503).json({ error: error.message });
  }
});

app.post('/api/transcribe', mediaLimiter, uploadVideo, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Thiếu file video.' });
  
  try {
    const metadata = await inspectVideo(req.file.path);
    const result = await callWorker({ op: 'transcribe', path: req.file.path, language: req.body?.language || 'auto' }, 12 * 60_000);
    
    const cues = (result.segments || []).map(seg => ({
      start: Math.max(0, Math.round(Number(seg.start || 0) * 1000)),
      end: Math.max(1, Math.round(Number(seg.end || 0) * 1000)),
      original: String(seg.text || '').trim(),
      vi: ''
    })).filter(cue => cue.original && cue.end > cue.start);
    
    if (!cues.length) return res.status(422).json({ error: 'Không nhận diện được giọng nói trong video.' });
    
    res.json({
      cues, detectedLanguage: result.language || 'auto',
      durationSeconds: metadata.duration, count: cues.length
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  } finally {
    await safeRemove(req.file.path);
  }
});

app.post('/api/render', mediaLimiter, uploadVideo, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Thiếu file video.' });
  let workDir = null;
  let sendingFile = false;
  
  try {
    await inspectVideo(req.file.path);
    const srt = req.body?.subtitleSrt;
    if (typeof srt !== 'string' || !srt.trim() || Buffer.byteLength(srt) > MAX_SUBTITLE_BYTES) {
      return res.status(400).json({ error: 'File SRT không hợp lệ hoặc quá lớn.' });
    }
    
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vietsub-'));
    const subPath = path.join(workDir, 'captions.srt');
    const outPath = path.join(workDir, 'out.mp4');
    await fs.writeFile(subPath, srt, 'utf8');
    
    const fontSize = Math.min(36, Math.max(14, Math.round(Number(req.body?.fontSize)) || 22));
    // scale auto to avoid "width not divisible by 2" FFmpeg error
    const vf = `scale=trunc(iw/2)*2:trunc(ih/2)*2,subtitles='${subPath.replace(/\\/g, '/')}':force_style='FontName=DejaVu Sans,FontSize=${fontSize},Outline=2,Shadow=1,Alignment=2,MarginV=35'`;
    
    await run('ffmpeg', [
      '-y', '-i', req.file.path,
      '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outPath
    ], FFMPEG_TIMEOUT_MS, false);

    sendingFile = true;
    res.download(outPath, 'hendy-vietsub.mp4', err => {
      safeRemove(workDir);
      if (err && !res.headersSent) res.status(500).json({ error: 'Lỗi truyền file.' });
    });
  } catch (error) {
    if (!res.headersSent) res.status(error.statusCode || 500).json({ error: error.message });
    await safeRemove(workDir);
  } finally {
    await safeRemove(req.file.path);
    if (!sendingFile) await safeRemove(workDir);
  }
});

app.use((error, _req, res, _next) => {
  if (!res.headersSent) res.status(500).json({ error: error.message || 'Internal Server Error' });
});

app.listen(PORT, '0.0.0.0', () => console.log('Hendy VietSub Studio Backend on port ' + PORT));
