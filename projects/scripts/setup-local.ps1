$ErrorActionPreference = 'Stop'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw '未检测到 Docker。请先安装并启动 Docker Desktop。'
}

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  throw '未检测到 Supabase CLI。Windows 可使用 Scoop 安装：scoop install supabase'
}

if (-not (Test-Path -LiteralPath '.env.local')) {
  Copy-Item -LiteralPath '.env.example' -Destination '.env.local'
  Write-Host '已从 .env.example 创建 .env.local。'
}

supabase start
supabase status

Write-Host ''
Write-Host '请把上方输出的 API URL、anon key、service_role key 填入 .env.local。'
Write-Host '然后填入 AI_BASE_URL、AI_API_KEY、AI_MODEL，并运行 pnpm local:check。'
