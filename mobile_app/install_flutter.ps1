# Automated Flutter SDK installer for Windows
# This script downloads the stable Flutter SDK, extracts it to C:\src\flutter, and updates the User PATH.

$ErrorActionPreference = "Stop"

# Define destination directory
$installDir = "C:\src"
$flutterBin = "$installDir\flutter\bin"
$zipPath = "$env:TEMP\flutter_windows_stable.zip"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  ⚡ WhatsApp CRM Mobile Companion App Setup  " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# 1. Create directory if not exists
if (!(Test-Path $installDir)) {
    Write-Host "Creating directory $installDir..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $installDir | Out-Null
}

# 2. Check if already installed
if (Test-Path "$installDir\flutter") {
    Write-Host "Flutter seems already unpacked at $installDir\flutter." -ForegroundColor Green
} else {
    Write-Host "Downloading Flutter Stable SDK..." -ForegroundColor Yellow
    # Fetching latest stable download URL
    $downloadUrl = "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.22.0-stable.zip"
    
    curl.exe -L -o $zipPath $downloadUrl
    
    Write-Host "Extracting Flutter SDK to $installDir..." -ForegroundColor Yellow
    Expand-Archive -Path $zipPath -DestinationPath $installDir -Force
    
    Write-Host "Cleaning temporary archive..." -ForegroundColor Yellow
    Remove-Item $zipPath
}

# 3. Add to user Path
Write-Host "Checking PATH environment variable..." -ForegroundColor Yellow
$oldPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
if ($oldPath -notlike "*$flutterBin*") {
    $newPath = "$oldPath;$flutterBin"
    [System.Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    Write-Host "✓ Added $flutterBin to User PATH." -ForegroundColor Green
    Write-Host "Please RESTART your terminal/IDE for path changes to take effect." -ForegroundColor Cyan
} else {
    Write-Host "✓ Flutter bin is already present in User PATH." -ForegroundColor Green
}

Write-Host "`n🎉 Installation complete! Open a NEW terminal and run:" -ForegroundColor Green
Write-Host "   flutter doctor" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
