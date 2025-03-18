const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const prisma = require('./db');

// These values should be moved to environment variables
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const CREDENTIALS_PATH = path.join(__dirname, '../config/google-credentials.json');

class GoogleDriveService {
  constructor() {
    this.credentials = null;
    this.loadCredentials();
  }

  loadCredentials() {
    try {
      if (fs.existsSync(CREDENTIALS_PATH)) {
        this.credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
    }
  }

  hasCredentials() {
    return this.credentials !== null;
  }

  createOAuth2Client() {
    if (!this.hasCredentials()) {
      throw new Error('Google Drive credentials not found. Please set up credentials first.');
    }

    const { client_secret, client_id, redirect_uris } = this.credentials.installed || this.credentials.web || {};
    
    if (!client_secret || !client_id || !redirect_uris) {
      throw new Error('Invalid credentials file format');
    }

    return new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris[0]
    );
  }

  async generateAuthUrl(userId) {
    try {
      const oAuth2Client = this.createOAuth2Client();
      const state = Buffer.from(JSON.stringify({ userId })).toString('base64');

      return oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        state: state,
        prompt: 'consent' // Force to show consent screen to get refresh_token
      });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      throw error;
    }
  }

  async setToken(code, userId) {
    try {
      const oAuth2Client = this.createOAuth2Client();
      const { tokens } = await oAuth2Client.getToken(code);
      
      // Save tokens to database
      await prisma.driveToken.upsert({
        where: { userId },
        create: {
          userId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
        }
      });

      return true;
    } catch (error) {
      console.error('Error setting token:', error);
      throw error;
    }
  }

  async getAuthenticatedClient(userId) {
    try {
      const token = await prisma.driveToken.findUnique({
        where: { userId }
      });

      if (!token) {
        throw new Error('User not authenticated with Google Drive');
      }

      const oAuth2Client = this.createOAuth2Client();
      oAuth2Client.setCredentials({
        access_token: token.accessToken,
        refresh_token: token.refreshToken
      });

      // Handle token refresh
      oAuth2Client.on('tokens', async (tokens) => {
        if (tokens.refresh_token) {
          await prisma.driveToken.update({
            where: { userId },
            data: {
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token
            }
          });
        } else {
          await prisma.driveToken.update({
            where: { userId },
            data: { accessToken: tokens.access_token }
          });
        }
      });

      return oAuth2Client;
    } catch (error) {
      console.error('Error getting authenticated client:', error);
      throw error;
    }
  }

  async ensureBackupFolder(userId) {
    try {
      const auth = await this.getAuthenticatedClient(userId);
      const drive = google.drive({ version: 'v3', auth });

      let token = await prisma.driveToken.findUnique({
        where: { userId }
      });

      if (token.folderId) {
        // Verify folder still exists
        try {
          await drive.files.get({ fileId: token.folderId });
          return token.folderId;
        } catch (error) {
          // Folder not found, will create new one
        }
      }

      // Search for existing backup folder
      const response = await drive.files.list({
        q: "name='InventoryBackups' and mimeType='application/vnd.google-apps.folder'",
        fields: 'files(id)',
      });

      let folderId;

      if (response.data.files.length > 0) {
        folderId = response.data.files[0].id;
      } else {
        // Create a new folder
        const fileMetadata = {
          name: 'InventoryBackups',
          mimeType: 'application/vnd.google-apps.folder',
        };

        const file = await drive.files.create({
          resource: fileMetadata,
          fields: 'id',
        });

        folderId = file.data.id;
      }

      // Save folder ID
      await prisma.driveToken.update({
        where: { userId },
        data: { folderId }
      });

      return folderId;
    } catch (error) {
      console.error('Error ensuring backup folder:', error);
      throw error;
    }
  }

  async uploadBackup(filePath, userId) {
    try {
      const auth = await this.getAuthenticatedClient(userId);
      const drive = google.drive({ version: 'v3', auth });
      const folderId = await this.ensureBackupFolder(userId);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileMetadata = {
        name: `backup-${timestamp}.sqlite`,
        parents: [folderId],
      };

      const media = {
        mimeType: 'application/x-sqlite3',
        body: fs.createReadStream(filePath),
      };

      const file = await drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id, name, createdTime',
      });

      return file.data;
    } catch (error) {
      console.error('Error uploading backup:', error);
      throw error;
    }
  }

  async listBackups(userId) {
    try {
      const auth = await this.getAuthenticatedClient(userId);
      const drive = google.drive({ version: 'v3', auth });
      const folderId = await this.ensureBackupFolder(userId);

      const response = await drive.files.list({
        q: `'${folderId}' in parents and mimeType='application/x-sqlite3'`,
        fields: 'files(id, name, createdTime, size)',
        orderBy: 'createdTime desc',
      });

      return response.data.files;
    } catch (error) {
      console.error('Error listing backups:', error);
      throw error;
    }
  }

  async downloadBackup(fileId, destinationPath, userId) {
    try {
      const auth = await this.getAuthenticatedClient(userId);
      const drive = google.drive({ version: 'v3', auth });
      
      const dest = fs.createWriteStream(destinationPath);
      
      const response = await drive.files.get(
        { fileId: fileId, alt: 'media' },
        { responseType: 'stream' }
      );

      return new Promise((resolve, reject) => {
        response.data
          .on('end', () => resolve())
          .on('error', err => reject(err))
          .pipe(dest);
      });
    } catch (error) {
      console.error('Error downloading backup:', error);
      throw error;
    }
  }

  async deleteBackup(fileId, userId) {
    try {
      const auth = await this.getAuthenticatedClient(userId);
      const drive = google.drive({ version: 'v3', auth });
      
      await drive.files.delete({ fileId });
      return true;
    } catch (error) {
      console.error('Error deleting backup:', error);
      throw error;
    }
  }
}

module.exports = new GoogleDriveService(); 