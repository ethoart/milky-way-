#!/bin/bash

# ==============================================================================
# Milky Way OMS - Automatic Monthly MongoDB Backup to Google Cloud Storage
# ==============================================================================

# Configuration
MONGODB_URI="mongodb://127.0.0.1:27017/milkyway_central"
GCS_BUCKET="your-gcs-bucket-name"
BACKUP_DIR="/tmp/mongodb_backups"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
ARCHIVE_NAME="milkyway_backup_$DATE.tar.gz"

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ">>> Starting Automated MongoDB Backup..."

# 1. Create temporary backup directory
mkdir -p "$BACKUP_DIR"

# 2. Perform mongodump
echo ">>> Dumping MongoDB database..."
mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/dump_$DATE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}>>> Database successfully dumped.${NC}"
else
    echo -e "${RED}>>> ERROR: mongodump failed. Ensure MongoDB is running and mongodump is installed.${NC}"
    exit 1
fi

# 3. Compress the backup
echo ">>> Compressing dump..."
tar -czf "$BACKUP_DIR/$ARCHIVE_NAME" -C "$BACKUP_DIR" "dump_$DATE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}>>> Compression complete: $ARCHIVE_NAME${NC}"
else
    echo -e "${RED}>>> ERROR: Compression failed.${NC}"
    rm -rf "$BACKUP_DIR/dump_$DATE"
    exit 1
fi

# 4. Upload to Google Cloud Storage
echo ">>> Uploading to Google Cloud Storage bucket (gs://$GCS_BUCKET)..."
gsutil cp "$BACKUP_DIR/$ARCHIVE_NAME" "gs://$GCS_BUCKET/backups/$ARCHIVE_NAME"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}>>> SUCCESS: Backup uploaded to GCS successfully.${NC}"
else
    echo -e "${RED}>>> ERROR: Upload failed. Ensure gsutil is installed, authenticated, and bucket exists.${NC}"
    # Keep local zip for safety, clean up raw dump
    rm -rf "$BACKUP_DIR/dump_$DATE"
    exit 1
fi

# 5. Clean up temporary directories and old local files
echo ">>> Cleaning up temporary files..."
rm -rf "$BACKUP_DIR/dump_$DATE"

# Retain local backups for 30 days locally, delete anything older
find "$BACKUP_DIR" -type f -name "*.tar.gz" -mtime +30 -delete

echo -e "${GREEN}>>> Backup process completed successfully!${NC}"
