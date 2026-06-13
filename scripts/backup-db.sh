#!/bin/bash

# Configuration
MONGODB_URI=${MONGODB_URI:-"mongodb://localhost:27017/whatsapp_platform"}
BACKUP_DIR=${BACKUP_DIR:-"/var/backups/hk-automation-mongodb"}
RETENTION_DAYS=${RETENTION_DAYS:-7}
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_NAME="hk-automation-db-$DATE"
DEST="$BACKUP_DIR/$BACKUP_NAME"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "Starting MongoDB backup at $(date)"
echo "Targeting destination: $DEST"

# Run mongodump
if mongodump --uri="$MONGODB_URI" --out="$DEST" --quiet; then
    # Archive the dump
    tar -czf "$DEST.tar.gz" -C "$BACKUP_DIR" "$BACKUP_NAME"
    rm -rf "$DEST"
    echo "Backup completed successfully: $DEST.tar.gz"
    
    # Prune old backups
    echo "Pruning backups older than $RETENTION_DAYS days..."
    find "$BACKUP_DIR" -type f -name "hk-automation-db-*.tar.gz" -mtime +$RETENTION_DAYS -delete
    echo "Pruning complete."
else
    echo "Error: MongoDB backup failed!" >&2
    exit 1
fi
