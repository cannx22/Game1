# Oyunu ücretsiz bir Cloudflare tüneliyle internete açar ve arkadaşlara gönderilecek linki gösterir.
# Hesap gerekmez. Bu pencere açık kaldığı sürece link çalışır.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$port = if ($env:PORT) { $env:PORT } else { 4747 }

function Test-Server {
  try { Invoke-WebRequest "http://localhost:$port/health" -UseBasicParsing -TimeoutSec 2 | Out-Null; return $true } catch { return $false }
}

Write-Host ''
Write-Host '  Civciv Kıyameti - internete açılıyor' -ForegroundColor Yellow
Write-Host ''

if (-not (Test-Server)) {
  Write-Host '  Oyun sunucusu çalışmıyor, yeni bir pencerede başlatılıyor...'
  if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Write-Host '  İlk kurulum yapılıyor (npm install)...'
    & npm install --omit=dev
  }
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', 'title Civciv Kiyameti - Sunucu & node server/index.js' -WorkingDirectory $root
  for ($i = 0; $i -lt 20 -and -not (Test-Server); $i++) { Start-Sleep -Milliseconds 500 }
  if (-not (Test-Server)) { Write-Host '  Sunucu başlatılamadı. Önce BASLAT.bat dosyasını çalıştırmayı dene.' -ForegroundColor Red; exit 1 }
}

# cloudflared: PATH'te varsa onu, yoksa tools klasörüne indirileni kullan
$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) {
  $tools = Join-Path $root 'tools'
  $cf = Join-Path $tools 'cloudflared.exe'
  if (-not (Test-Path $cf)) {
    New-Item -ItemType Directory -Force $tools | Out-Null
    Write-Host '  Cloudflare tünel aracı indiriliyor (yalnızca ilk seferde, ~50 MB)...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $arch = if ([Environment]::Is64BitOperatingSystem) { 'amd64' } else { '386' }
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-$arch.exe" -OutFile $cf -UseBasicParsing
  }
}

$log = Join-Path $env:TEMP "civciv-tunnel-$PID.log"
$proc = Start-Process -FilePath $cf -ArgumentList 'tunnel', '--no-autoupdate', '--url', "http://localhost:$port" -RedirectStandardError $log -RedirectStandardOutput "$log.out" -NoNewWindow -PassThru

$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
  Start-Sleep -Milliseconds 500
  if ($proc.HasExited) { break }
  if (Test-Path $log) {
    $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value }
  }
}

if (-not $url) {
  Write-Host '  Tünel açılamadı. İnternet bağlantını kontrol edip tekrar dene.' -ForegroundColor Red
  if (Test-Path $log) { Get-Content $log -Tail 15 }
  if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
  exit 1
}

try { Set-Clipboard -Value $url } catch { }
Write-Host ''
Write-Host '  ================================================================' -ForegroundColor Green
Write-Host '   Oyun internete açıldı! Arkadaşlarına bu linki gönder:' -ForegroundColor Green
Write-Host ''
Write-Host "     $url" -ForegroundColor Cyan
Write-Host ''
Write-Host '   (Link panoya kopyalandı. Bu pencereyi kapatınca link çalışmaz.)' -ForegroundColor Green
Write-Host '  ================================================================' -ForegroundColor Green
Write-Host ''
Write-Host '  Linkin aktif olması 10-20 saniye sürebilir. Sen de aynı linkten ya da'
Write-Host "  http://localhost:$port adresinden oynayabilirsin."
Start-Process $url
Wait-Process -Id $proc.Id
