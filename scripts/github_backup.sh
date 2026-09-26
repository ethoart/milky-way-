#!/bin/bash

# ==============================================================================
# Milky Way OMS - Automatic Monthly MongoDB Backup to Private GitHub Repository
# ==============================================================================

# Configuration
MONGODB_URI="mongodb://127.0.0.1:27017/milkyway_central"

# Path to the directory where you cloned your PRIVATE backup GitHub repository
# e.g., git clone https://github.com/your-username/milkyway-backups.git /home/user/milkyway-backups
BACKUP_GIT_REPO_DIR="/home/user/milkyway-backups"

DATE=$(date +"%Y-%m-%d_%H-%M-%S")
ARCHIVE_NAME="milkyway_backup_$DATE.tar.gz"

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ">>> Starting Automated MongoDB Backup to GitHub..."

# 1. Verify directory exists and is a Git repository
if [ ! -d "$BACKUP_GIT_REPO_DIR" ] || [ ! -d "$BACKUP_GIT_REPO_DIR/.git" ]; then
    echo -e "${RED}>>> ERROR: Directory '$BACKUP_GIT_REPO_DIR' does not exist or is not a cloned git repository.${NC}"
    echo "Please clone your private backups repository first!"
    exit 1
fi

# 2. Perform mongodump
echo ">>> Dumping MongoDB database..."
TEMP_DUMP_DIR="/tmp/dump_$DATE"
mongodump --uri="$MONGODB_URI" --out="$TEMP_DUMP_DIR"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}>>> Database successfully dumped.${NC}"
else
    echo -e "${RED}>>> ERROR: mongodump failed. Ensure MongoDB is running.${NC}"
    exit 1
fi

# 3. Compress directly into the GitHub repository directory
echo ">>> Compressing dump to archive..."
tar -czf "$BACKUP_GIT_REPO_DIR/$ARCHIVE_NAME" -C "/tmp" "dump_$DATE"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}>>> Compression complete: $ARCHIVE_NAME${NC}"
else
    echo -e "${RED}>>> ERROR: Compression failed.${NC}"
    rm -rf "$TEMP_DUMP_DIR"
    exit 1
fi

# 4. Clean up temporary files
rm -rf "$TEMP_DUMP_DIR"

# 5. Git Commit and Push to GitHub
echo ">>> Navigating to Git repository..."
cd "$BACKUP_GIT_REPO_DIR"

echo ">>> Staging backup file..."
git add "$ARCHIVE_NAME"

echo ">>> Committing backup..."
git commit -m "Automated Monthly Backup - $DATE"

echo ">>> Pushing database backup to GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo -e "${GREEN}>>> SUCCESS: Backup successfully pushed to your private GitHub repository!${NC}"
else
    echo -e "${RED}>>> ERROR: Git push failed. Ensure ssh-agent is configured or a Personal Access Token is saved.${NC}"
    exit 1
fi

# 6. Housekeeping: Keep only the last 3 local backups in the directory to prevent git repo from getting too large
# (Old backups will still remain safely in your GitHub history!)
echo ">>> Retaining last 3 backup files..."
ls -t *.tar.gz | tail -n +4 | xargs -I {} rm -- {}

echo -e "${GREEN}>>> Process completed successfully!${NC}"
