const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class WhatsAppService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.isReady = false;
    this.latestQR = null;
    this.initialize();
  }

  initialize() {
    // Create client with local authentication
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        args: ['--no-sandbox']
      }
    });

    // Generate QR code
    this.client.on('qr', (qr) => {
      console.log('WhatsApp QR Code generated');
      this.latestQR = qr;
      this.emit('qr', qr);
    });

    // Handle ready state
    this.client.on('ready', () => {
      console.log('WhatsApp client is ready!');
      this.isReady = true;
      this.latestQR = null;
      this.emit('ready');
    });

    // Handle authentication
    this.client.on('authenticated', () => {
      console.log('WhatsApp client is authenticated!');
      this.latestQR = null;
      this.emit('authenticated');
    });

    // Handle authentication failures
    this.client.on('auth_failure', (msg) => {
      console.error('WhatsApp authentication failed:', msg);
      this.emit('auth_failure', msg);
    });

    // Handle disconnects
    this.client.on('disconnected', (reason) => {
      console.log('WhatsApp client was disconnected:', reason);
      this.isReady = false;
      this.latestQR = null;
      this.emit('disconnected', reason);
    });

    // Initialize the client
    this.client.initialize();
  }

  getQR() {
    return this.latestQR;
  }

  async sendBackup(phoneNumber, filePath) {
    try {
      if (!this.isReady) {
        throw new Error('WhatsApp client is not ready. Please scan the QR code first.');
      }

      // Format phone number
      phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
      if (!phoneNumber.startsWith('92')) {
        phoneNumber = '92' + phoneNumber;
      }
      const chatId = phoneNumber + '@c.us';

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error('Backup file not found');
      }

      // Create message media from file
      const media = MessageMedia.fromFilePath(filePath);
      
      // Get current date and time for message
      const timestamp = new Date().toLocaleString('en-PK');
      
      // Send backup file with message
      await this.client.sendMessage(chatId, `🔒 Database Backup\n📅 ${timestamp}\n\nThis is an automated backup from your Inventory Management System.`);
      await this.client.sendMessage(chatId, media, {
        caption: 'Database Backup File'
      });

      return true;
    } catch (error) {
      console.error('Error sending backup via WhatsApp:', error);
      throw error;
    }
  }

  async isAuthenticated() {
    return this.isReady;
  }

  async logout() {
    try {
      if (this.client) {
        await this.client.logout();
        this.isReady = false;
      }
    } catch (error) {
      console.error('Error logging out from WhatsApp:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
const whatsappService = new WhatsAppService();
module.exports = whatsappService; 