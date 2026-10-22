# ==========================================
# STAGE 1: Tầng xây dựng (Builder)
# ==========================================
FROM node:20-bullseye-slim AS builder

WORKDIR /app

# Cài đặt các công cụ build tạm thời
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Tạo môi trường ảo Python (venv) để gom gọn các thư viện AI
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Cài đặt Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Tải sẵn model Whisper và Argos Translate vào thư mục cache ẩn (~/.cache)
COPY backend/preload_models.py ./backend/
RUN python3 backend/preload_models.py

# Cài đặt Node.js production dependencies
COPY package*.json ./
RUN npm ci --omit=dev


# ==========================================
# STAGE 2: Tầng chạy thực tế (Runtime Slim)
# ==========================================
FROM node:20-bullseye-slim

WORKDIR /app

# Chỉ cài đặt các gói runtime tối thiểu (Bắt buộc phải có python3 và ffmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 1. Copy môi trường Python hoàn chỉnh từ tầng builder sang
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# 2. Copy bộ nhớ cache model AI từ tầng builder sang (nếu muốn giữ tính năng pre-cache)
COPY --from=builder /root/.cache /root/.cache

# 3. Copy các gói Node.js đã tối ưu từ tầng builder sang
COPY --from=builder /app/node_modules ./node_modules

# 4. Copy mã nguồn ứng dụng
COPY . .

# Tạo thư mục chứa file upload
RUN mkdir -p uploads

EXPOSE 3000
CMD ["node", "backend/server.js"]
