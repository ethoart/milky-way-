#!/bin/bash

# ==============================================================================
# Milky Way OMS - Automatic Monthly MongoDB Backup to Google Drive
# ==============================================================================

# Configuration
MONGODB_URI="mongodb://127.0.0.1:27017/milkyway_central"
# Path to your mounted Google Drive directory (e.g. via rclone or Google Drive desktop mount)
GDRIVE_BACKUP_DIR="/mnt/gdrive/My Drive/MilkyWay_Backups"
TEMP_DIR="/tmp/mongodb_backups"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
ARCHIVE_NAME="milkyway_backup_$DATE.tar.gz"

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ">>> Starting Automated MongoDB Backup for Google Drive..."

# 1. Create temporary and Google Drive backup directory if they don't exist
mkdir -p "$TEMP_DIR"
mkdir -p "$GDRIVE_BACKUP_DIR"

# 2. Perform mongodump
echo ">>> Dumping MongoDB database..."
mongodump --uri="$MONGODB_URI" --out="$TEMP_DIR/dump_$DATE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}>>> Database successfully dumped.${NC}"
else
    echo -e "${RED}>>> ERROR: mongodump failed. Ensure MongoDB is running and mongodump is installed.${NC}"
    exit 1
fi

# 3. Compress the backup
echo ">>> Compressing dump..."
tar -czf "$TEMP_DIR/$ARCHIVE_NAME" -C "$TEMP_DIR" "dump_$DATE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}>>> Compression complete: $ARCHIVE_NAME${NC}"
else
    echo -e "${RED}>>> ERROR: Compression failed.${NC}"
    rm -rf "$TEMP_DIR/dump_$DATE"
    exit 1
fi

# 4. Copy backup to Google Drive sync folder
echo ">>> Moving backup file to Google Drive: $GDRIVE_BACKUP_DIR/$ARCHIVE_NAME"
cp "$TEMP_DIR/$ARCHIVE_NAME" "$GDRIVE_BACKUP_DIR/$ARCHIVE_NAME"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}>>> SUCCESS: Backup copied to Google Drive sync folder. Cloud syncing will begin shortly.${NC}"
else
    echo -e "${RED}>>> ERROR: Failed to copy to Google Drive directory. Check paths and permissions.${NC}"
    rm -rf "$TEMP_DIR/dump_$DATE"
    exit 1
fi

# 5. Clean up temporary files
echo ">>> Cleaning up temporary files..."
rm -rf "$TEMP_DIR/dump_$DATE"
rm -f "$TEMP_DIR/$ARCHIVE_NAME"

# Retain backups for 90 days in Google Drive, delete anything older
find "$GDRIVE_BACKUP_DIR" -type f -name "*.tar.gz" -mtime +90 -delete

echo -e "${GREEN}>>> Backup process completed successfully!${NC}"
