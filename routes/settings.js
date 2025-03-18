const express = require('express');
const router = express.Router();
const prisma = require('../utils/db');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const multer = require('multer');
const googleDrive = require('../utils/googleDrive');
const whatsapp = require('../utils/whatsapp');

// Configure multer for logo uploads
const logoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../public/uploads');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Use 'logo' as filename and keep the original extension
    const ext = path.extname(file.originalname);
    cb(null, 'logo' + ext);
  }
});

const logoUpload = multer({ 
  storage: logoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    // Accept only images
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Configure multer for database backup uploads
const backupStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../backups/temp');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    cb(null, `restore-${timestamp}.sqlite`);
  }
});

const backupUpload = multer({ 
  storage: backupStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: function (req, file, cb) {
    // Accept only sqlite files
    if (!file.originalname.match(/\.(sqlite|db|backup)$/)) {
      return cb(new Error('Only database backup files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Get settings page
router.get('/', async (req, res) => {
  try {
    // Get shop settings
    const settings = await prisma.settings.findFirst();
    
    // Check WhatsApp connection status
    const isWhatsAppConnected = await whatsapp.isAuthenticated();
    
    res.render('settings/index', {
      user: req.user,
      settings: settings || {},
      activePage: 'settings',
      successMessage: req.query.success,
      errorMessage: req.query.error,
      isWhatsAppConnected
    });
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).render('settings/index', { 
      user: req.user,
      settings: {},
      activePage: 'settings',
      errorMessage: 'Error loading settings',
      isWhatsAppConnected: false
    });
  }
});

// Update shop details
router.post('/update-shop', async (req, res) => {
  try {
    const { 
      shopName, 
      address, 
      phone, 
      email, 
      taxId,
      footer
    } = req.body;
    
    // Check if settings exist
    const existingSettings = await prisma.settings.findFirst();
    
    if (existingSettings) {
      // Update existing settings
      await prisma.settings.update({
        where: { id: existingSettings.id },
        data: {
          shopName,
          address,
          phone,
          email,
          taxId,
          footer
        }
      });
    } else {
      // Create new settings
      await prisma.settings.create({
        data: {
          shopName,
          address,
          phone,
          email,
          taxId,
          footer
        }
      });
    }
    
    res.redirect('/settings?success=Shop details updated successfully');
  } catch (error) {
    console.error('Update shop details error:', error);
    res.redirect('/settings?error=Failed to update shop details');
  }
});

// Upload logo
router.post('/upload-logo', logoUpload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.redirect('/settings?error=No file uploaded');
    }
    
    // Get the file extension
    const ext = path.extname(req.file.originalname);
    const logoFilename = 'logo' + ext;
    
    // Update settings with logo filename
    const existingSettings = await prisma.settings.findFirst();
    if (existingSettings) {
      await prisma.settings.update({
        where: { id: existingSettings.id },
        data: { shopLogo: logoFilename }
      });
    } else {
      await prisma.settings.create({
        data: { shopLogo: logoFilename }
      });
    }
    
    res.redirect('/settings?success=Logo uploaded successfully');
  } catch (error) {
    console.error('Logo upload error:', error);
    res.redirect('/settings?error=Failed to upload logo');
  }
});

// Create database backup
router.post('/backup', (req, res) => {
  try {
    const backupDir = path.join(__dirname, '../backups');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-${timestamp}.sqlite`);
    
    // Get database path from .env
    // The DATABASE_URL in .env is "file:./dev.db", but the actual file is in the prisma directory
    const dbPath = path.join(__dirname, '../prisma/dev.db');
    
    // Copy database file
    fs.copyFileSync(dbPath, backupFile);
    
    // Create a downloadable file
    const downloadPath = path.join(__dirname, '../public/downloads');
    if (!fs.existsSync(downloadPath)) {
      fs.mkdirSync(downloadPath, { recursive: true });
    }
    
    const downloadFile = path.join(downloadPath, 'backup.sqlite');
    fs.copyFileSync(backupFile, downloadFile);
    
    res.redirect('/settings?success=Backup created successfully. Click the download button to save it.');
  } catch (error) {
    console.error('Backup error:', error);
    res.redirect('/settings?error=Failed to create backup');
  }
});

// Restore database from backup
router.post('/restore', backupUpload.single('backupFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.redirect('/settings?error=No backup file uploaded');
    }
    
    // Get database path from .env
    // The DATABASE_URL in .env is "file:./dev.db", but the actual file is in the prisma directory
    const dbPath = path.join(__dirname, '../prisma/dev.db');
    
    // Create a backup of current database before restoring
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const currentBackup = path.join(backupDir, `pre-restore-${timestamp}.sqlite`);
    
    // Copy current database
    fs.copyFileSync(dbPath, currentBackup);
    
    // Replace database with uploaded file
    fs.copyFileSync(req.file.path, dbPath);
    
    // Delete uploaded file
    fs.unlinkSync(req.file.path);
    
    res.redirect('/settings?success=Database restored successfully. Please restart the application.');
  } catch (error) {
    console.error('Restore error:', error);
    res.redirect('/settings?error=Failed to restore database');
  }
});

// Google Drive Auth
router.get('/google-auth', async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login?error=Please login first');
    }

    if (!googleDrive.hasCredentials()) {
      return res.redirect('/settings?error=Google Drive credentials not found. Please contact administrator.');
    }

    const authUrl = await googleDrive.generateAuthUrl(req.user.id);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Google auth error:', error);
    res.redirect('/settings?error=' + encodeURIComponent('Failed to authenticate with Google Drive: ' + error.message));
  }
});

router.get('/google-callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.redirect('/settings?error=Invalid authentication response');
    }

    // Decode state to get userId
    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString());
    
    if (!userId || (req.user && req.user.id !== userId)) {
      return res.redirect('/settings?error=Invalid authentication state');
    }

    await googleDrive.setToken(code, userId);
    res.redirect('/settings?success=Successfully connected to Google Drive');
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect('/settings?error=Failed to connect to Google Drive: ' + error.message);
  }
});

// Backup to Google Drive
router.post('/backup-to-drive', async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login?error=Please login first');
    }

    const backupDir = path.join(__dirname, '../backups');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-${timestamp}.sqlite`);
    
    // Get database path
    const dbPath = path.join(__dirname, '../prisma/dev.db');
    
    // Copy database file
    fs.copyFileSync(dbPath, backupFile);
    
    // Upload to Google Drive
    const file = await googleDrive.uploadBackup(backupFile, req.user.id);
    
    // Delete local backup file
    fs.unlinkSync(backupFile);
    
    res.redirect('/settings?success=Backup uploaded to Google Drive successfully');
  } catch (error) {
    console.error('Google Drive backup error:', error);
    res.redirect('/settings?error=Failed to upload backup to Google Drive: ' + error.message);
  }
});

// List Google Drive backups
router.get('/drive-backups', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Please login first' });
    }

    const backups = await googleDrive.listBackups(req.user.id);
    res.json(backups);
  } catch (error) {
    console.error('List drive backups error:', error);
    if (error.message.includes('not authenticated')) {
      return res.status(401).json({ error: 'Please connect your Google Drive account first' });
    }
    res.status(500).json({ error: 'Failed to list Google Drive backups' });
  }
});

// Restore from Google Drive backup
router.post('/restore-from-drive/:fileId', async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/login?error=Please login first');
    }

    const { fileId } = req.params;
    
    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, '../backups/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Download backup file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const tempFile = path.join(tempDir, `restore-${timestamp}.sqlite`);
    
    await googleDrive.downloadBackup(fileId, tempFile, req.user.id);
    
    // Get database path
    const dbPath = path.join(__dirname, '../prisma/dev.db');
    
    // Create a backup of current database before restoring
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const currentBackup = path.join(backupDir, `pre-restore-${timestamp}.sqlite`);
    
    // Copy current database
    fs.copyFileSync(dbPath, currentBackup);
    
    // Replace database with downloaded file
    fs.copyFileSync(tempFile, dbPath);
    
    // Delete temp file
    fs.unlinkSync(tempFile);
    
    res.redirect('/settings?success=Database restored successfully from Google Drive backup. Please restart the application.');
  } catch (error) {
    console.error('Restore from drive error:', error);
    res.redirect('/settings?error=Failed to restore from Google Drive backup: ' + error.message);
  }
});

// Delete Google Drive backup
router.post('/delete-drive-backup/:fileId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Please login first' });
    }

    const { fileId } = req.params;
    await googleDrive.deleteBackup(fileId, req.user.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete drive backup error:', error);
    res.status(500).json({ error: 'Failed to delete Google Drive backup' });
  }
});

// WhatsApp Connection Status
router.get('/whatsapp-status', async (req, res) => {
  try {
    const isConnected = await whatsapp.isAuthenticated();
    const qrCode = whatsapp.getQR();
    res.json({ 
      connected: isConnected,
      qrCode: qrCode
    });
  } catch (error) {
    console.error('WhatsApp status error:', error);
    res.status(500).json({ error: 'Failed to check WhatsApp status' });
  }
});

// Disconnect WhatsApp
router.post('/whatsapp-logout', async (req, res) => {
  try {
    await whatsapp.logout();
    res.redirect('/settings?success=WhatsApp disconnected successfully');
  } catch (error) {
    console.error('WhatsApp logout error:', error);
    res.redirect('/settings?error=Failed to disconnect WhatsApp');
  }
});

// Send backup via WhatsApp
router.post('/backup-to-whatsapp', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.redirect('/settings?error=Please provide a phone number');
    }

    const backupDir = path.join(__dirname, '../backups');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `backup-${timestamp}.sqlite`);
    
    // Get database path
    const dbPath = path.join(__dirname, '../prisma/dev.db');
    
    // Copy database file
    fs.copyFileSync(dbPath, backupFile);
    
    // Send to WhatsApp
    await whatsapp.sendBackup(phoneNumber, backupFile);
    
    // Delete local backup file
    fs.unlinkSync(backupFile);
    
    res.redirect('/settings?success=Backup sent via WhatsApp successfully');
  } catch (error) {
    console.error('WhatsApp backup error:', error);
    res.redirect('/settings?error=Failed to send backup via WhatsApp: ' + error.message);
  }
});

module.exports = router; 