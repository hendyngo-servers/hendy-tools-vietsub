'use strict';

const crypto = require('node:crypto');
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

const allowedOrigins = (process.env.ALLOWED_ORIGINS ||
  'https://hendyngo-servers.github.io,http://localhost:8080,http://127.0.0.1:8080')
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
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});
const renderLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Đã đạt giới hạn xuất video tạm thời. Hãy thử lại sau.' }
});

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1, fields: 3, fieldSize: MAX_SUBTITLE_BYTES }
});

function translationUrl() {
  const value = process.env.LIBRETRANSLATE_URL || process.env.TRANSLATE_URL;
  if (!value) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
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
    child.once('error', () => finish(new Error('Không thể chạy công cụ xử lý media. Kiểm tra FFmpeg trong image.')));
    child.once('close', (code) => {
      if (code !== 0) return finish(new Error(captureOutput ? 'Không đọc được thông tin video.' : 'FFmpeg không thể ghép phụ đề vào video.'));
      finish(null, { stdout, stderr });
    });
  });
}

function cleanTempDir(dir) {
  if (dir) return fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  return Promise.resolve();
}

app.get('/', (_req, res) => {
  res.json({
    name: 'Hendy Tools Vietsub API',
    version: '2.1.0',
    endpoints: ['/health', '/api/translate', '/api/render']
  });
});

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    translationConfigured: Boolean(translationUrl()),
    videoRendering: true,
    maxVideoBytes: MAX_VIDEO_BYTES,
    maxVideoSeconds: MAX_VIDEO_SECONDS
  });
});

app.post('/api/translate', translateLimiter, async (req, res) => {
  const endpoint = translationUrl();
  if (!endpoint) {
    return res.status(503).json({ error: 'Backend chưa được cấu hình LIBRETRANSLATE_URL.' });
  }

  const { q, source = 'auto', target = 'vi', format = 'text' } = req.body || {};
  if (typeof q !== 'string' || !q.trim() || q.length > 5000) {
    return res.status(400).json({ error: 'q phải là chuỗi không rỗng và tối đa 5000 ký tự.' });
  }
  if (typeof source !== 'string' || source.length > 30 || typeof target !== 'string' || target.length > 30) {
    return res.status(400).json({ error: 'Mã ngôn ngữ không hợp lệ.' });
  }

  const payload = { q, source: source || 'auto', target: target || 'vi', format: format === 'html' ? 'html' : 'text' };
  if (process.env.LIBRETRANSLATE_API_KEY) payload.api_key = process.env.LIBRETRANSLATE_API_KEY;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25_000)
    });
    if (!response.ok) {
      return res.status(502).json({ error: 'Dịch vụ dịch trả về HTTP ' + response.status + '.' });
    }
    const data = await response.json();
    if (typeof data.translatedText !== 'string') {
      return res.status(502).json({ error: 'Phản hồi từ dịch vụ dịch không có translatedText.' });
    }
    return res.json({ translatedText: data.translatedText });
  } catch (error) {
    const timedOut = error && error.name === 'TimeoutError';
    return res.status(502).json({
      error: timedOut ? 'Dịch vụ dịch quá thời gian chờ.' : 'Không kết nối được dịch vụ dịch.'
    });
  }
});

app.post('/api/render', renderLimiter, (req, res, next) => {
  upload.single('video')(req, res, (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        const message = error.code === 'LIMIT_FILE_SIZE'
          ? 'Video vượt quá giới hạn 200 MB.'
          : 'Dữ liệu tải lên không hợp lệ hoặc vượt giới hạn.';
        return res.status(400).json({ error: message });
      }
      return next(error);
    }
    return next();
  });
}, async (req, res) => {
  const uploaded = req.file;
  let workDir = null;
  if (!uploaded) return res.status(400).json({ error: 'Thiếu file video (field name: video).' });

  try {
    const extension = path.extname(uploaded.originalname || '').toLowerCase();
    const allowedExtensions = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v']);
    if (!allowedExtensions.has(extension)) {
      return res.status(400).json({ error: 'Định dạng video hỗ trợ: MP4, MOV, MKV, WEBM, M4V.' });
    }
    const srt = req.body && req.body.subtitleSrt;
    if (typeof srt !== 'string' || !srt.trim() || Buffer.byteLength(srt, 'utf8') > MAX_SUBTITLE_BYTES || !srt.includes('-->')) {
      return res.status(400).json({ error: 'Thiếu phụ đề SRT hợp lệ hoặc file phụ đề vượt 350 KB.' });
    }

    workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hendy-vietsub-'));
    const subtitlePath = path.join(workDir, 'captions.srt');
    const outputPath = path.join(workDir, 'hendy-vietsub.mp4');
    await fs.writeFile(subtitlePath, '\uFEFF' + srt, { encoding: 'utf8', flag: 'wx' });

    const probe = await run('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration:stream=codec_type',
      '-of', 'json', uploaded.path
    ], 15_000, true);
    let metadata;
    try { metadata = JSON.parse(probe.stdout); } catch { metadata = null; }
    const duration = Number(metadata && metadata.format && metadata.format.duration);
    const hasVideo = Array.isArray(metadata && metadata.streams) && metadata.streams.some((stream) => stream.codec_type === 'video');
    if (!hasVideo || !Number.isFinite(duration) || duration <= 0) {
      return res.status(400).json({ error: 'File tải lên không có video hợp lệ.' });
    }
    if (duration > MAX_VIDEO_SECONDS) {
      return res.status(413).json({ error: 'Bản triển khai hiện giới hạn video tối đa 10 phút.' });
    }

    const rawSize = Number(req.body && req.body.fontSize);
    const fontSize = Number.isFinite(rawSize) ? Math.min(36, Math.max(14, Math.round(rawSize))) : 22;
    const vf = "subtitles='" + subtitlePath + "':force_style='FontName=DejaVu Sans,FontSize=" +
      fontSize + ",Outline=2,Shadow=1,Alignment=2,MarginV=35'";

    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', uploaded.path,
      '-map', '0:v:0', '-map', '0:a?',
      '-vf', vf,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath
    ], FFMPEG_TIMEOUT_MS, false);

    res.setHeader('Cache-Control', 'no-store');
    res.download(outputPath, 'hendy-vietsub.mp4', (error) => {
      cleanTempDir(workDir);
      if (error && !res.headersSent) {
        res.status(500).json({ error: 'Không thể tải video đã xử lý.' });
      }
    });
  } catch (error) {
    await cleanTempDir(workDir);
    if (!res.headersSent) {
      const message = error && /Quá thời gian/.test(error.message)
        ? error.message
        : 'Không thể xử lý video. Hãy kiểm tra định dạng, thời lượng và thử clip ngắn hơn.';
      res.status(500).json({ error: message });
    }
  } finally {
    await fs.rm(uploaded.path, { force: true }).catch(() => {});
  }
});

app.use((error, _req, res, _next) => {
  const status = error && error.message && error.message.includes('Origin is not allowed') ? 403 : 500;
  if (!res.headersSent) res.status(status).json({ error: status === 403 ? 'Origin không được phép.' : 'Lỗi máy chủ.' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('Hendy Tools Vietsub API listening on port ' + PORT);
});
server.requestTimeout = 270_000;
server.headersTimeout = 275_000;
