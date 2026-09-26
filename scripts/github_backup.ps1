# ==============================================================================
# Milky Way OMS - Automatic Monthly MongoDB Backup to Private GitHub Repository (Windows)
# ==============================================================================

# Configuration
$MONGODB_URI = "mongodb://127.0.0.1:27017/milkyway_central"

# Path to the directory where you cloned your PRIVATE backup GitHub repository
# e.g., git clone https://github.com/your-username/milkyway-backups.git C:\milkyway-backups
$BACKUP_GIT_REPO_DIR = "C:\path\to\your\cloned\milkyway-backups"

$DATE = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$ARCHIVE_NAME = "milkyway_backup_$DATE.zip"

Write-Host ">>> Starting Automated MongoDB Backup to GitHub (Windows)..." -ForegroundColor Cyan

# 1. Verify directory exists and is a Git repository
if (!(Test-Path $BACKUP_GIT_REPO_DIR) -or !(Test-Path (Join-Path $BACKUP_GIT_REPO_DIR ".git"))) {
    Write-Host ">>> ERROR: Directory '$BACKUP_GIT_REPO_DIR' does not exist or is not a cloned git repository." -ForegroundColor Red
    Write-Host "Please clone your private backups repository first!" -ForegroundColor Yellow
    Exit 1
}

# 2. Perform mongodump
Write-Host ">>> Dumping MongoDB database..." -ForegroundColor Yellow
$TEMP_DUMP_DIR = Join-Path $env:TEMP "dump_$DATE"

# Run mongodump (ensure MongoDB Database Tools are installed and in PATH)
& mongodump --uri="$MONGODB_URI" --out="$TEMP_DUMP_DIR"

if ($LASTEXITCODE -eq 0) {
    Write-Host ">>> Database successfully dumped." -ForegroundColor Green
} else {
    Write-Host ">>> ERROR: mongodump failed. Ensure MongoDB is running and MongoDB Database Tools are installed." -ForegroundColor Red
    Exit 1
}

# 3. Compress directly into the GitHub repository directory
Write-Host ">>> Compressing dump to archive..." -ForegroundColor Yellow
$TARGET_ZIP_PATH = Join-Path $BACKUP_GIT_REPO_DIR $ARCHIVE_NAME

# Compress using Powershell Utility (handles .zip format seamlessly)
Compress-Archive -Path $TEMP_DUMP_DIR -DestinationPath $TARGET_ZIP_PATH -Force

if ($LASTEXITCODE -eq 0 -or (Test-Path $TARGET_ZIP_PATH)) {
    Write-Host ">>> Compression complete: $ARCHIVE_NAME" -ForegroundColor Green
} else {
    Write-Host ">>> ERROR: Compression failed." -ForegroundColor Red
    Remove-Item -Recurse -Force $TEMP_DUMP_DIR -ErrorAction SilentlyContinue
    Exit 1
}

# 4. Clean up temporary dump directory
Remove-Item -Recurse -Force $TEMP_DUMP_DIR -ErrorAction SilentlyContinue

# 5. Git Commit and Push to GitHub
Write-Host ">>> Navigating to Git repository..." -ForegroundColor Yellow
Set-Location $BACKUP_GIT_REPO_DIR

Write-Host ">>> Staging backup file..." -ForegroundColor Yellow
& git add $ARCHIVE_NAME

Write-Host ">>> Committing backup..." -ForegroundColor Yellow
& git commit -m "Automated Monthly Backup - $DATE"

Write-Host ">>> Pushing database backup to GitHub..." -ForegroundColor Yellow
& git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ">>> SUCCESS: Backup successfully pushed to your private GitHub repository!" -ForegroundColor Green
} else {
    Write-Host ">>> ERROR: Git push failed. Ensure git is authenticated (e.g. using SSH keys or stored credential helper)." -ForegroundColor Red
    Exit 1
}

# 6. Housekeeping: Keep only the last 3 local backups in the directory to prevent git repo from getting too large
# (Old backups will still remain safely in your GitHub history!)
Write-Host ">>> Retaining last 3 backup files..." -ForegroundColor Yellow
$localBackups = Get-ChildItem -Path $BACKUP_GIT_REPO_DIR -Filter "*.zip" | Sort-Object LastWriteTime -Descending
if ($localBackups.Count -gt 3) {
    $backupsToDelete = $localBackups | Select-Object -Skip 3
    foreach ($backup in $backupsToDelete) {
        Remove-Item -Path $backup.FullName -Force
        Write-Host "Removed old local backup file: $($backup.Name)" -ForegroundColor DarkGray
    }
}

Write-Host ">>> Process completed successfully!" -ForegroundColor Green
