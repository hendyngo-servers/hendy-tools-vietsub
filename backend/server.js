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
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by ALLOWED_ORIGINS'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  maxAge: 600
}));
app.use(express.json({ limit: '512kb' }));

const translateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});
const mediaLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Đã đạt giới hạn xử lý media tạm thời. Hãy thử lại sau.' }
});
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1, fields: 4, fieldSize: MAX_SUBTITLE_BYTES }
});

let workerReady = false;
let workerStartupError = "";
let workerInfo = { translationLanguages: [], whisperModelAvailable: false };
let workerCounter = 0;
let workerBuffer = '';
const pendingWorkerRequests = new Map();
const workerPath = path.join(__dirname, 'offline_worker.py');
const pythonBin = process.env.PYTHON_BIN || 'python3';
const worker = spawn(pythonBin, [workerPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: process.env
});

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
      workerStartupError = String(message.error || 'Mô hình offline chưa khởi động được.').slice(0, 500);
      console.error('Offline Vietsub worker startup failed: ' + workerStartupError);
      continue;
    }
    if (message.type === 'ready') {
      workerInfo = {
        translationLanguages: Array.isArray(message.translationLanguages) ? message.translationLanguages : [],
        whisperModelAvailable: Boolean(message.whisperModelAvailable)
      };
      workerReady = workerInfo.translationLanguages.includes('vi') &&
        workerInfo.translationLanguages.includes('en') &&
        workerInfo.translationLanguages.length > 2;
      workerStartupError = workerReady ? '' : 'Bộ mô hình dịch không đầy đủ.';
      console.log('Offline Vietsub worker ready. Languages: ' + workerInfo.translationLanguages.join(', '));
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
  if (line) console.error('[offline-worker] ' + line.slice(0, 1000));
});
worker.on('error', (error) => {
  workerReady = false;
  workerStartupError = 'Không thể khởi động bộ máy offline.';
  console.error('Could not start offline model worker: ' + error.message);
  for (const pending of pendingWorkerRequests.values()) {
    clearTimeout(pending.timer);
    pending.reject(new Error('Không khởi động được bộ máy Vietsub cục bộ.'));
  }
  pendingWorkerRequests.clear();
});
worker.on('exit', (code) => {
  workerReady = false;
  const reason = new Error('Bộ máy Vietsub cục bộ đã dừng (code ' + code + ').');
  for (const pending of pendingWorkerRequests.values()) {
    clearTimeout(pending.timer);
    pending.reject(reason);
  }
  pendingWorkerRequests.clear();
  console.error(reason.message);
});

function callWorker(payload, timeoutMs = WORKER_TIMEOUT_MS) {
  if (!workerReady) {
    return Promise.reject(new Error('Bộ máy Vietsub đang khởi động hoặc chưa sẵn sàng. Hãy thử lại sau vài giây.'));
  }
  return new Promise((resolve, reject) => {
    const id = String(++workerCounter);
    const timer = setTimeout(() => {
      pendingWorkerRequests.delete(id);
      reject(new Error('Tác vụ offline vượt quá thời gian cho phép.'));
    }, timeoutMs);
    pendingWorkerRequests.set(id, { resolve, reject, timer });
    try {
      worker.stdin.write(JSON.stringify({ ...payload, id }) + '\n', (error) => {
        if (!error) return;
        const pending = pendingWorkerRequests.get(id);
        if (pending) {
          pendingWorkerRequests.delete(id);
          clearTimeout(pending.timer);
          pending.reject(new Error('Không gửi được tác vụ đến bộ máy offline.'));
        }
      });
    } catch (_) {
      pendingWorkerRequests.delete(id);
      clearTimeout(timer);
      reject(new Error('Không gửi được tác vụ đến bộ máy offline.'));
    }
  });
}

function run(command, args, timeoutMs, captureOutput = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : 'ignore' });
    let stdout = '';
    let stderr = '';
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
      child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk) => { if (stderr.length < 8000) stderr += chunk.toString(); });
    }
    child.once('error', () => finish(new Error('Không chạy được công cụ xử lý media. Kiểm tra FFmpeg trong image.')));
    child.once('close', (code) => {
      if (code !== 0) return finish(new Error(captureOutput ? 'Không đọc được thông tin video.' : 'FFmpeg không thể ghép phụ đề vào video.'));
      finish(null, { stdout, stderr });
    });
  });
}

async function inspectVideo(file) {
  const probe = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration:stream=codec_type',
    '-of', 'json', file
  ], 20_000, true);
  let metadata;
  try { metadata = JSON.parse(probe.stdout); } catch (_) { metadata = null; }
  const duration = Number(metadata && metadata.format && metadata.format.duration);
  const hasVideo = Array.isArray(metadata && metadata.streams) &&
    metadata.streams.some((stream) => stream.codec_type === 'video');
  if (!hasVideo || !Number.isFinite(duration) || duration <= 0) {
    throw new Error('Tệp tải lên không có video hợp lệ.');
  }
  if (duration > MAX_VIDEO_SECONDS) {
    const error = new Error('Bản cấu hình mặc định giới hạn video tối đa 10 phút.');
    error.statusCode = 413;
    throw error;
  }
  return { duration, streams: metadata.streams };
}

function cleanTempDir(dir) {
  if (dir) return fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  return Promise.resolve();
}

function uploadVideo(req, res, next) {
  upload.single('video')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const message = error.code === 'LIMIT_FILE_SIZE'
        ? 'Video vượt quá giới hạn 200 MB.'
        : 'Dữ liệu tải lên không hợp lệ hoặc vượt giới hạn.';
      return res.status(400).json({ error: message });
    }
    return next(error);
  });
}

function checkVideoExtension(file) {
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (!new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v']).has(extension)) {
    throw new Error('Định dạng video hỗ trợ: MP4, MOV, MKV, WEBM, M4V.');
  }
}

app.get('/', (_req, res) => {
  res.json({
    name: 'Hendy VietSub Offline Studio',
    version: '2.2.1',
    externalTranslationApiRequired: false,
    endpoints: ['/health', '/api/translate', '/api/translate-batch', '/api/transcribe', '/api/render']
  });
});

app.get('/health', (_req, res) => {
  const ok = workerReady;
  res.status(ok ? 200 : 503).json({
    ok,
    status: ok ? 'ready' : 'starting_or_failed',
    offlineEngineReady: workerReady,
    offlineTranslation: workerReady && workerInfo.translationLanguages.length > 0,
    speechRecognition: workerReady && workerInfo.whisperModelAvailable,
    videoRendering: true,
    translationLanguages: workerInfo.translationLanguages,
    externalTranslationApiRequired: false,
    maxVideoBytes: MAX_VIDEO_BYTES,
    maxVideoSeconds: MAX_VIDEO_SECONDS,
    ...(workerStartupError ? { workerError: workerStartupError } : {})
  });
});

async function handleBatchTranslate(req, res) {
  const body = req.body || {};
  let texts;
  if (Array.isArray(body.texts)) texts = body.texts;
  else if (typeof body.q === 'string') texts = [body.q];
  else return res.status(400).json({ error: 'Cần cung cấp q hoặc mảng texts.' });
  if (!texts.length || texts.length > 40 || texts.some((text) => typeof text !== 'string' || !text.trim() || text.length > 5000)) {
    return res.status(400).json({ error: 'Gửi từ 1 đến 40 câu; mỗi câu tối đa 5000 ký tự và không được rỗng.' });
  }
  const source = typeof body.source === 'string' ? body.source : 'auto';
  const target = typeof body.target === 'string' ? body.target : 'vi';
  if (target !== 'vi') return res.status(400).json({ error: 'Bộ dịch tích hợp hiện xuất Vietsub tiếng Việt (target=vi).' });
  try {
    const result = await callWorker({ op: 'translate', texts, source, target }, 180_000);
    if (texts.length === 1 && typeof body.q === 'string') return res.json({ translatedText: result.translations[0] });
    return res.json({ translations: result.translations, detectedLanguages: result.detectedLanguages || [] });
  } catch (error) {
    const status = /không có mô hình|không hỗ trợ|ngôn ngữ/i.test(error.message) ? 422 : 503;
    return res.status(status).json({ error: error.message });
  }
}

app.post('/api/translate', translateLimiter, handleBatchTranslate);
app.post('/api/translate-batch', translateLimiter, handleBatchTranslate);

app.post('/api/transcribe', mediaLimiter, uploadVideo, async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Thiếu video cần nhận dạng (field name: video).' });
  try {
    checkVideoExtension(file);
    const metadata = await inspectVideo(file.path);
    const language = typeof req.body.language === 'string' ? req.body.language : 'auto';
    const result = await callWorker({ op: 'transcribe', path: file.path, language }, 12 * 60_000);
    const cues = (result.segments || []).map((segment) => ({
      start: Math.max(0, Math.round(Number(segment.start || 0) * 1000)),
      end: Math.max(1, Math.round(Number(segment.end || 0) * 1000)),
      original: String(segment.text || '').trim(),
      vi: ''
    })).filter((cue) => cue.original && cue.end > cue.start);
    if (!cues.length) return res.status(422).json({ error: 'Không nhận diện được lời thoại rõ ràng trong video.' });
    res.json({
      cues,
      detectedLanguage: result.language || language,
      languageProbability: result.languageProbability || 0,
      durationSeconds: metadata.duration,
      count: cues.length
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Không thể nhận dạng giọng nói từ video.' });
  } finally {
    await fs.rm(file.path, { force: true }).catch(() => {});
  }
});

app.post('/api/render', mediaLimiter, uploadVideo, async (req, res) => {
  const file = req.file;
  let workDir = null;
  let sendingFile = false;
  if (!file) return res.status(400).json({ error: 'Thiếu file video (field name: video).' });
  try {
    checkVideoExtension(file);
    await inspectVideo(file.path);
    const srt = req.body && req.body.subtitleSrt;
    if (typeof srt !== 'string' || !srt.trim() ||
      Buffer.byteLength(srt, 'utf8') > MAX_SUBTITLE_BYTES || !srt.includes('-->')) {
      return res.status(400).json({ error: 'Thiếu phụ đề SRT hợp lệ hoặc file phụ đề vượt 350 KB.' });
    }
    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hendy-vietsub-'));
    const subtitlePath = path.join(workDir, 'captions.srt');
    const outputPath = path.join(workDir, 'hendy-vietsub.mp4');
    await fs.writeFile(subtitlePath, srt, { encoding: 'utf8', flag: 'wx' });
    const rawSize = Number(req.body.fontSize);
    const fontSize = Number.isFinite(rawSize) ? Math.min(36, Math.max(14, Math.round(rawSize))) : 22;
    const vf = "subtitles='" + subtitlePath + "':force_style='FontName=DejaVu Sans,FontSize=" +
      fontSize + ",Outline=2,Shadow=1,Alignment=2,MarginV=35'";
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', file.path,
      '-map', '0:v:0', '-map', '0:a?',
      '-vf', vf,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath
    ], FFMPEG_TIMEOUT_MS, false);

    res.setHeader('Cache-Control', 'no-store');
    sendingFile = true;
    res.download(outputPath, 'hendy-vietsub.mp4', (error) => {
      cleanTempDir(workDir);
      if (error && !res.headersSent) res.status(500).json({ error: 'Không thể tải video đã xử lý.' });
    });
  } catch (error) {
    await cleanTempDir(workDir);
    if (!res.headersSent) res.status(error.statusCode || 500).json({ error: error.message || 'Không thể ghép phụ đề vào video.' });
  } finally {
    await fs.rm(file.path, { force: true }).catch(() => {});
    if (!sendingFile) await cleanTempDir(workDir);
  }
});

app.use((error, _req, res, _next) => {
  const forbidden = error && error.message && error.message.includes('Origin is not allowed');
  if (!res.headersSent) res.status(forbidden ? 403 : 500).json({ error: forbidden ? 'Origin không được phép.' : 'Lỗi máy chủ.' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('Hendy VietSub Offline Studio listening on port ' + PORT);
});
server.requestTimeout = 12 * 60_000;
server.headersTimeout = 12 * 60_000 + 10_000;
