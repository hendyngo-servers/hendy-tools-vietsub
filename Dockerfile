FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PYTHONUNBUFFERED=1 \
    PYTHON_BIN=/opt/venv/bin/python \
    ARGOS_DEVICE_TYPE=cpu \
    ARGOS_PACKAGES_DIR=/opt/argos/packages \
    WHISPER_MODEL_PATH=/opt/models/whisper-tiny \
    OMP_NUM_THREADS=2 \
    HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    TOKENIZERS_PARALLELISM=false

WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg fonts-dejavu-core python3 python3-venv python3-pip ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/venv

COPY requirements.txt ./
RUN /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt
COPY package.json ./
RUN npm install --omit=dev
COPY backend ./backend
RUN mkdir -p /opt/argos/packages /opt/models \
    && /opt/venv/bin/python backend/install_models.py \
    && chown -R node:node /app /opt/argos /opt/models

USER node
EXPOSE 10000
CMD ["npm", "start"]
