const TelegramBot = require('node-telegram-bot-api');
const sharp = require('sharp');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { format } = require('util');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Bot token from environment variables
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Store user states
const userStates = new Map();

// Supported formats
const SUPPORTED_FORMATS = {
  'png': 'PNG',
  'jpeg': 'JPEG',
  'jpg': 'JPEG',
  'webp': 'WEBP',
  'tiff': 'TIFF',
  'avif': 'AVIF',
  'heif': 'HEIF'
};

const OUTPUT_FORMATS = ['png', 'jpeg', 'webp', 'tiff', 'avif', 'heif'];

// Temporary directory for files
const TEMP_DIR = path.join(__dirname, 'temp');

// Ensure temp directory exists
const ensureTempDir = async () => {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating temp directory:', error);
  }
};
ensureTempDir();

// Welcome message
const WELCOME_MESSAGE = `
🖼️ Welcome to Image Converter Bot!

Send me an image and I'll convert it to your desired format.

📌 How to use:
1. Send any image
2. Choose the output format when prompted
3. Get your converted image!

Supported formats: ${OUTPUT_FORMATS.join(', ')}
`;

// Start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, WELCOME_MESSAGE);
});

// Help command
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, `
🖼️ Image Converter Bot Help

Commands:
/start - Start the bot
/help - Show this help message
/formats - Show supported formats
/cancel - Cancel current operation

How to use:
1. Send me an image (photo or document)
2. Choose a format from the options
3. Wait for the conversion
  `);
});

// Formats command
bot.onText(/\/formats/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, `
📋 Supported Formats:

Input: All common image formats
Output: ${OUTPUT_FORMATS.join(', ')}

Quality: High-quality conversion preserving image resolution
  `);
});

// Cancel command
bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  const state = userStates.get(chatId);
  if (state) {
    // Clean up any files
    if (state.filePath) {
      try {
        await fs.unlink(state.filePath);
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }
    userStates.delete(chatId);
    await bot.sendMessage(chatId, '❌ Operation cancelled.');
  } else {
    await bot.sendMessage(chatId, 'No active operation to cancel.');
  }
});

// Handle image messages
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const photo = msg.photo[msg.photo.length - 1]; // Get highest quality
  
  try {
    const file = await bot.getFile(photo.file_id);
    const filePath = path.join(TEMP_DIR, `input_${Date.now()}.jpg`);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    
    // Download the file
    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(buffer));
    
    // Get image info
    const metadata = await sharp(filePath).metadata();
    
    // Store file path and metadata in user state
    userStates.set(chatId, {
      filePath,
      originalFormat: metadata.format,
      width: metadata.width,
      height: metadata.height
    });
    
    await showFormatOptions(chatId);
  } catch (error) {
    console.error('Error processing photo:', error);
    await bot.sendMessage(chatId, '❌ Error processing your image. Please try again.');
  }
});

// Handle document images
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  const document = msg.document;
  
  // Check if it's an image
  const mimeType = document.mime_type;
  if (!mimeType || !mimeType.startsWith('image/')) {
    await bot.sendMessage(chatId, '⚠️ Please send an image file.');
    return;
  }
  
  try {
    const file = await bot.getFile(document.file_id);
    const fileExt = path.extname(document.file_name) || '.jpg';
    const filePath = path.join(TEMP_DIR, `input_${Date.now()}${fileExt}`);
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    
    // Download the file
    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(buffer));
    
    // Get image info
    const metadata = await sharp(filePath).metadata();
    
    // Store file path and metadata in user state
    userStates.set(chatId, {
      filePath,
      originalFormat: metadata.format,
      width: metadata.width,
      height: metadata.height
    });
    
    await showFormatOptions(chatId);
  } catch (error) {
    console.error('Error processing document:', error);
    await bot.sendMessage(chatId, '❌ Error processing your image. Please try again.');
  }
});

// Show format selection options
const showFormatOptions = async (chatId) => {
  const options = OUTPUT_FORMATS.map(format => ({
    text: format.toUpperCase(),
    callback_data: `convert_${format}`
  }));
  
  // Split into rows of 3
  const keyboard = [];
  for (let i = 0; i < options.length; i += 3) {
    keyboard.push(options.slice(i, i + 3));
  }
  
  keyboard.push([{ text: '❌ Cancel', callback_data: 'cancel_conversion' }]);
  
  await bot.sendMessage(chatId, '🔄 Select output format:', {
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
};

// Handle callback queries (format selection)
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  
  if (data === 'cancel_conversion') {
    const state = userStates.get(chatId);
    if (state && state.filePath) {
      try {
        await fs.unlink(state.filePath);
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }
    userStates.delete(chatId);
    await bot.sendMessage(chatId, '❌ Conversion cancelled.');
    await bot.answerCallbackQuery(query.id);
    return;
  }
  
  if (data.startsWith('convert_')) {
    const format = data.replace('convert_', '');
    const state = userStates.get(chatId);
    
    if (!state || !state.filePath) {
      await bot.sendMessage(chatId, '❌ No image to convert. Please send an image first.');
      await bot.answerCallbackQuery(query.id);
      return;
    }
    
    await bot.answerCallbackQuery(query.id, `Converting to ${format.toUpperCase()}...`);
    await convertImage(chatId, format);
  }
});

// Convert image function
const convertImage = async (chatId, outputFormat) => {
  const state = userStates.get(chatId);
  
  if (!state) {
    await bot.sendMessage(chatId, '❌ No image found. Please send an image first.');
    return;
  }
  
  try {
    await bot.sendMessage(chatId, `🔄 Converting to ${outputFormat.toUpperCase()}... Please wait.`);
    
    const inputPath = state.filePath;
    const outputPath = path.join(TEMP_DIR, `output_${Date.now()}.${outputFormat}`);
    
    // Perform conversion using sharp
    const pipeline = sharp(inputPath);
    
    // Handle different output formats
    switch (outputFormat) {
      case 'png':
        await pipeline.png({ quality: 100 }).toFile(outputPath);
        break;
      case 'jpeg':
      case 'jpg':
        await pipeline.jpeg({ quality: 90 }).toFile(outputPath);
        break;
      case 'webp':
        await pipeline.webp({ quality: 90 }).toFile(outputPath);
        break;
      case 'tiff':
        await pipeline.tiff({ quality: 90 }).toFile(outputPath);
        break;
      case 'avif':
        await pipeline.avif({ quality: 90 }).toFile(outputPath);
        break;
      case 'heif':
        await pipeline.heif({ quality: 90 }).toFile(outputPath);
        break;
      default:
        throw new Error(`Unsupported format: ${outputFormat}`);
    }
    
    // Get file stats
    const stats = await fs.stat(outputPath);
    
    // Send the converted image
    await bot.sendDocument(chatId, outputPath, {
      caption: `
✅ Conversion Complete!

📄 Format: ${outputFormat.toUpperCase()}
📦 Size: ${(stats.size / 1024).toFixed(1)} KB
📐 Resolution: ${state.width}×${state.height}

Use /start to convert another image!
      `
    });
    
    // Clean up
    await fs.unlink(inputPath);
    await fs.unlink(outputPath);
    userStates.delete(chatId);
    
  } catch (error) {
    console.error('Error converting image:', error);
    await bot.sendMessage(chatId, `❌ Error converting image: ${error.message}`);
    
    // Clean up on error
    if (state.filePath) {
      try {
        await fs.unlink(state.filePath);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
    }
    userStates.delete(chatId);
  }
};

// Health check endpoint for Railway
app.get('/', (req, res) => {
  res.send('Image Converter Bot is running!');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('🤖 Image Converter Bot is running...');
});

// Error handling
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
