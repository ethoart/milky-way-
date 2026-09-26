# ==============================================================================
# Milky Way OMS - Automatic Monthly MongoDB Backup to Google Drive (Windows)
# ==============================================================================

# Configuration
$MongoDB_URI = "mongodb://127.0.0.1:27017/milkyway_central"

# Path to your Google Drive Desktop virtual letter (Usually G:\My Drive\)
$GDrive_Path = "G:\My Drive\MilkyWay_Backups"

$Temp_Dir = "C:\mongodb_backups"
$Date = Get-Date -Format "yyyy-MM-8d_HH-mm-ss"
$Dump_Path = "$Temp_Dir\dump_$Date"
$Archive_Name = "milkyway_backup_$Date.zip"
$Archive_Path = "$Temp_Dir\$Archive_Name"

Write-Host ">>> Starting Automated MongoDB Backup for Google Drive..." -ForegroundColor Green

# 1. Create directories if they don't exist
if (!(Test-Path $Temp_Dir)) {
    New-Item -ItemType Directory -Force -Path $Temp_Dir
}
if (!(Test-Path $GDrive_Path)) {
    New-Item -ItemType Directory -Force -Path $GDrive_Path
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

# 4. Copy file to Google Drive folder
Write-Host ">>> Moving backup file to Google Drive: $GDrive_Path"
Copy-Item -Path $Archive_Path -Destination "$GDrive_Path\$Archive_Name" -Force

if ($LASTEXITCODE -eq 0 -or (Test-Path "$GDrive_Path\$Archive_Name")) {
    Write-Host ">>> SUCCESS: Backup copied to Google Drive successfully. Desktop app will sync it to cloud." -ForegroundColor Green
} else {
    Write-Warning "ERROR: Copy to Google Drive failed. Check drive letter path."
}

# 5. Clean up temporary local files
Write-Host ">>> Cleaning up temporary files..."
Remove-Item -Recurse -Force $Dump_Path
Remove-Item -Force $Archive_Path

# Retain backups for 90 days in Google Drive, delete anything older
Get-ChildItem -Path $GDrive_Path -Filter "*.zip" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-90) } | Remove-Item -Force

Write-Host ">>> Backup process completed successfully!" -ForegroundColor Green
