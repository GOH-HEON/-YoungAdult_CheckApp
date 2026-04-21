#!/bin/zsh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "[YoungAdult_CheckApp] 프로젝트 경로: $PROJECT_DIR"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "오류: node/npm 명령을 찾을 수 없습니다."
  echo "터미널에서 source ~/.zshrc 실행 후 다시 시도하세요."
  exit 1
fi

if [ ! -f ".env.local" ]; then
  echo "경고: .env.local 파일이 없습니다."
  echo "필요하면 .env.local.example 또는 .env.rtf를 참고해 먼저 생성하세요."
fi

if [ ! -d "node_modules" ]; then
  echo "의존성 설치 중..."
  npm install
fi

# 서버 준비를 기다렸다가 브라우저 자동 오픈
(
  for _ in {1..30}; do
    if curl -sSf "http://localhost:3000/login" >/dev/null 2>&1; then
      open "http://localhost:3000/dashboard" >/dev/null 2>&1 || true
      exit 0
    fi
    sleep 1
  done
  # 준비 지연 시에도 브라우저는 열어둠
  open "http://localhost:3000/dashboard" >/dev/null 2>&1 || true
) &

echo "개발 서버 시작: http://localhost:3000"
npm run dev
