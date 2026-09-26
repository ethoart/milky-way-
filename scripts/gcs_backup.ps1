# ==============================================================================
# Milky Way OMS - Automatic Monthly MongoDB Backup to Google Cloud Storage (Windows)
# ==============================================================================

# Configuration
$MongoDB_URI = "mongodb://127.0.0.1:27017/milkyway_central"
$GCS_Bucket = "your-gcs-bucket-name"
$Backup_Dir = "C:\mongodb_backups"
$Date = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$Dump_Path = "$Backup_Dir\dump_$Date"
$Archive_Name = "milkyway_backup_$Date.zip"
$Archive_Path = "$Backup_Dir\$Archive_Name"

Write-Host ">>> Starting Automated MongoDB Backup..." -ForegroundColor Green

# 1. Create backup directory if it doesn't exist
if (!(Test-Path $Backup_Dir)) {
    New-Item -ItemType Directory -Force -Path $Backup_Dir
}

# 2. Perform mongodump
Write-Host ">>> Dumping MongoDB database..."
& mongodump --uri=$MongoDB_URI --out=$Dump_Path

if ($LASTEXITCODE -eq 0) {
    Write-Host ">>> Database successfully dumped." -ForegroundColor Green
} else {
    Write-Error "ERROR: mongodump failed. Ensure MongoDB is running and mongodump is in your PATH."
    Exit
}

# 3. Compress the backup
Write-Host ">>> Compressing dump..."
Compress-Archive -Path $Dump_Path -DestinationPath $Archive_Path -Force

if (Test-Path $Archive_Path) {
    Write-Host ">>> Compression complete: $Archive_Name" -ForegroundColor Green
} else {
    Write-Error "ERROR: Compression failed."
    Remove-Item -Recurse -Force $Dump_Path
    Exit
}

# 4. Upload to Google Cloud Storage
Write-Host ">>> Uploading to Google Cloud Storage (gs://$GCS_Bucket)..."
& gsutil cp $Archive_Path "gs://$GCS_Bucket/backups/$Archive_Name"

if ($LASTEXITCODE -eq 0) {
    Write-Host ">>> SUCCESS: Backup uploaded to GCS successfully." -ForegroundColor Green
} else {
    Write-Warning "ERROR: Upload failed. Ensure gsutil is installed, authenticated, and bucket exists."
    Remove-Item -Recurse -Force $Dump_Path
    Exit
}

# 5. Clean up temporary files
Write-Host ">>> Cleaning up temporary files..."
Remove-Item -Recurse -Force $Dump_Path

# Retain local backups for 30 days locally, delete anything older
Get-ChildItem -Path $Backup_Dir -Filter "*.zip" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item -Force

Write-Host ">>> Backup process completed successfully!" -ForegroundColor Green
