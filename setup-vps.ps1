# === Zalo Bot VPS Setup Script ===
# Chay script nay trong PowerShell (Admin) tren VPS
$ErrorActionPreference = "Stop"
Write-Host "=== Zalo Bot VPS Setup ===" -ForegroundColor Cyan

# 1. Cai Node.js 20 LTS
Write-Host "`n[1/6] Cai dat Node.js 20 LTS..." -ForegroundColor Yellow
$nodeInstaller = "$env:TEMP\node-setup.msi"
Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.18.3/node-v20.18.3-x64.msi" -OutFile $nodeInstaller
Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /qn" -Wait
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
Write-Host "  Node.js installed!" -ForegroundColor Green

# 2. Cai Git
Write-Host "`n[2/6] Cai dat Git..." -ForegroundColor Yellow
$gitInstaller = "$env:TEMP\git-setup.exe"
Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.2/Git-2.47.1.2-64-bit.exe" -OutFile $gitInstaller
Start-Process $gitInstaller -ArgumentList "/VERYSILENT /NORESTART /NOCANCEL /SP- /CLOSEAPPLICATIONS /RESTARTAPPLICATIONS" -Wait
$env:Path += ";C:\Program Files\Git\bin"
Write-Host "  Git installed!" -ForegroundColor Green

# 3. Clone repo
Write-Host "`n[3/6] Clone repo..." -ForegroundColor Yellow
$botDir = "D:\bot_zalo"
if (Test-Path $botDir) {
    Set-Location $botDir
    git pull
} else {
    git clone "https://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@github.com/laoto1/bot-zalo.git" $botDir
    Set-Location $botDir
}
Write-Host "  Repo cloned!" -ForegroundColor Green

# 4. Tao .env
Write-Host "`n[4/6] Tao file .env..." -ForegroundColor Yellow
@"
GCLI_BASE_URL=https://gcli.ggchan.dev
GCLI_API_KEY=gg-gcli-ndLpL-5BiP71gXUSTJCcFT_KeD6_MAKOgBWXAXWLb1w
GCLI_MODEL=gemini-3.1-pro-preview,假流式-gemini-3.1-pro-preview
GOOGLE_API_KEYS=AQ.Ab8RN6JLLO5e0ZJepBNwL1OAycOm4oQT3xzxHBK3-JoCJpiKew,AQ.Ab8RN6IEG-oxB0W5g--5Prc7jZDKY2T0GNEfU3iKxOtVQGCWYQ,AQ.Ab8RN6LKRrTpjui3qB94yzpaVApDjiRCXfe_8HlvbS1uWs76hQ,AQ.Ab8RN6LME3zvlMIEAs9MzI74rnL_wrecNLafX558DeSY2TXGAg,AQ.Ab8RN6K1ZXVfzrY72IowYESFXbbByLknsnNXweqk1s8YjX8nlA,AQ.Ab8RN6L1qB-K1LjTyxUk7BCtF8liU6mP19bc1ixDdgE5JZL8Sg,AQ.Ab8RN6Kk1Y1RMUMEiIRQTrCdq60fAVOUGGHlqU6j4a34NZePjw,AQ.Ab8RN6IWk66Cf1PO9Fa_9WpkeCeXD7eW9UnbFNUrmbnL9rQcog,AQ.Ab8RN6JsAzCLmA2frGYdeiFYs-YTduzMxBVM4TbQ45XoVtn5YQ,AQ.Ab8RN6LrR6aVT_eRAichd5Z9IrHCQmeT4I3JaZReb8pHV1iqwg
BOT_CREATOR_ID=2142031406833449183
BOT_MANAGER_ID=8770591533423251922
MAX_HISTORY=50
MAX_IMAGE_SIZE_MB=5
NSFW_ENABLED=true
RAG_TOP_K=5
RAG_MIN_SIMILARITY=0.7
ALLOWED_GROUPS=289252788416845926
"@ | Out-File -FilePath "$botDir\.env" -Encoding utf8
Write-Host "  .env created!" -ForegroundColor Green

# 5. npm install
Write-Host "`n[5/6] Installing dependencies..." -ForegroundColor Yellow
npm install
Write-Host "  Done!" -ForegroundColor Green

# 6. PM2
Write-Host "`n[6/6] Setting up PM2..." -ForegroundColor Yellow
npm install -g pm2
npm install -g pm2-windows-startup
pm2-startup install
pm2 start npm --name "zalo-bot" -- run dev
pm2 save
Write-Host "`n=== Setup xong! Bot dang chay! ===" -ForegroundColor Cyan
Write-Host "  pm2 logs zalo-bot   - Xem log"
Write-Host "  pm2 restart zalo-bot - Restart"
Write-Host "  LUU Y: Copy credentials.json tu may cu sang D:\bot_zalo\data\" -ForegroundColor Red
