import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==============================================================================
# CONFIGURATION
# ==============================================================================
const MONGODB_URI = 'mongodb://127.0.0.1:27017/milkyway_central';

// Your Gmail authentication details
const SENDER_EMAIL = 'your-email@gmail.com';         // The Gmail address sending the backup
const APP_PASSWORD = 'your-google-app-password';     // 16-character App Password (NOT your normal password)
const RECEIVER_EMAIL = 'your-email@gmail.com';       // The email address that should receive the backup

// Local Temp directory
const TEMP_DIR = path.join(__dirname, '..', 'tmp_backups');
// ==============================================================================

const dateStr = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
const dumpPath = path.join(TEMP_DIR, `dump_${dateStr}`);
const archivePath = path.join(TEMP_DIR, `milkyway_backup_${dateStr}.tar.gz`);

// Ensure temporary folder exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

console.log('>>> Step 1: Dumping MongoDB database...');

exec(`mongodump --uri="${MONGODB_URI}" --out="${dumpPath}"`, (error, stdout, stderr) => {
    if (error) {
        console.error('>>> ERROR: Database dump failed:', error.message);
        process.exit(1);
    }
    
    console.log('>>> Step 2: Compressing database dump...');
    
    // Cross-platform tar compression command
    const tarCmd = process.platform === 'win32'
        ? `powershell -Command "Compress-Archive -Path '${dumpPath}' -DestinationPath '${archivePath}' -Force"`
        : `tar -czf "${archivePath}" -C "${TEMP_DIR}" "dump_${dateStr}"`;

    exec(tarCmd, (compressError) => {
        if (compressError) {
            console.error('>>> ERROR: Compression failed:', compressError.message);
            cleanupTemp(dumpPath, null);
            process.exit(1);
        }

        console.log('>>> Step 3: Sending backup email to Gmail...');
        sendBackupEmail(archivePath, () => {
            console.log('>>> Step 4: Cleaning up local temporary files...');
            cleanupTemp(dumpPath, archivePath);
            console.log('>>> SUCCESS: Automatic Gmail Backup complete!');
        });
    });
});

function sendBackupEmail(filePath, callback) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: SENDER_EMAIL,
            pass: APP_PASSWORD
        }
    });

    const mailOptions = {
        from: `"MilkyWay OMS Backup" <${SENDER_EMAIL}>`,
        to: RECEIVER_EMAIL,
        subject: `[BACKUP] MilkyWay OMS Database Snapshot - ${new Date().toLocaleDateString()}`,
        text: `Hello,\n\nPlease find attached the automated database backup for your MilkyWay OMS system compiled on ${new Date().toString()}.\n\nKeep this file in a safe place.\n\nBest regards,\nMilkyWay OMS automated robot`,
        attachments: [
            {
                filename: path.basename(filePath),
                path: filePath
            }
        ]
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('>>> ERROR: Failed to send backup email:', error.message);
            process.exit(1);
        }
        console.log('>>> Email successfully sent! Message ID:', info.messageId);
        callback();
    });
}

function cleanupTemp(folder, file) {
    try {
        if (folder && fs.existsSync(folder)) {
            fs.rmSync(folder, { recursive: true, force: true });
        }
        if (file && fs.existsSync(file)) {
            fs.unlinkSync(file);
        }
    } catch (e) {
        console.warn('>>> Warning during temp cleanup:', e.message);
    }
}
