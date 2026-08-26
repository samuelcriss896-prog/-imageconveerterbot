const TelegramBot = require('node-telegram-bot-api');
const sharp = require('sharp');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
require('dotenv').config();

// Environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;

// Validate bot token
if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN is required!');
    console.error('Please set BOT_TOKEN in environment variables');
    process.exit(1);
}

// Initialize express app
const app = express();

// Health check endpoints
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        bot: 'Image Converter Bot',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
});

// Initialize bot
const bot = new TelegramBot(BOT_TOKEN, { 
    polling: true,
    onlyFirstMatch: true
});

console.log('🤖 Image Converter Bot is starting...');

// Supported output formats
const OUTPUT_FORMATS = ['png', 'jpeg', 'webp', 'tiff', 'avif', 'heif'];

// Store user states
const userStates = new Map();

// Temp directory
const TEMP_DIR = path.join(__dirname, 'temp');

// Ensure temp directory exists
async function ensureTempDir() {
    try {
        await fs.mkdir(TEMP_DIR, { recursive: true });
        console.log('📁 Temp directory ready');
    } catch (error) {
        console.error('❌ Error creating temp directory:', error);
    }
}
ensureTempDir();

// Welcome message
const WELCOME_MESSAGE = `
🖼️ Welcome to Image Converter Bot!

Send me an image and I'll convert it to your desired format.

📌 How to use:
1. Send any image
2. Choose output format
3. Get converted image!

Supported formats: ${OUTPUT_FORMATS.join(', ')}
`;

// Start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    try {
        await bot.sendMessage(chatId, WELCOME_MESSAGE);
    } catch (error) {
        console.error('Error in /start:', error);
    }
});

// Help command
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, `
🖼️ Image Converter Bot Help

Commands:
/start - Start the bot
/help - Show this help
/formats - Show supported formats
/cancel - Cancel current operation

How to use:
1. Send me an image
2. Choose a format
3. Wait for conversion
    `);
});

// Formats command
bot.onText(/\/formats/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, `
📋 Supported Formats:

Input: All common image formats
Output: ${OUTPUT_FORMATS.join(', ')}

Quality: High-quality conversion
    `);
});

// Cancel command
bot.onText(/\/cancel/, async (msg) => {
    const chatId = msg.chat.id;
    const state = userStates.get(chatId);
    if (state && state.filePath) {
        try {
            await fs.unlink(state.filePath).catch(() => {});
        } catch (error) {
            console.error('Error deleting file:', error);
        }
        userStates.delete(chatId);
        await bot.sendMessage(chatId, '❌ Operation cancelled.');
    } else {
        await bot.sendMessage(chatId, 'No active operation to cancel.');
    }
});

// Handle photo messages
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const photo = msg.photo[msg.photo.length - 1];
    
    try {
        await bot.sendMessage(chatId, '📥 Downloading image...');
        
        const file = await bot.getFile(photo.file_id);
        const filePath = path.join(TEMP_DIR, `input_${Date.now()}.jpg`);
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
        
        // Download file
        const response = await fetch(fileUrl);
        const buffer = await response.arrayBuffer();
        await fs.writeFile(filePath, Buffer.from(buffer));
        
        // Get image metadata
        const metadata = await sharp(filePath).metadata();
        
        userStates.set(chatId, {
            filePath,
            originalFormat: metadata.format,
            width: metadata.width,
            height: metadata.height,
            size: metadata.size
        });
        
        await showFormatOptions(chatId);
    } catch (error) {
        console.error('Error processing photo:', error);
        await bot.sendMessage(chatId, '❌ Error processing image. Please try again.');
    }
});

// Handle document messages
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const document = msg.document;
    
    if (!document.mime_type || !document.mime_type.startsWith('image/')) {
        await bot.sendMessage(chatId, '⚠️ Please send an image file.');
        return;
    }
    
    try {
        await bot.sendMessage(chatId, '📥 Downloading image...');
        
        const file = await bot.getFile(document.file_id);
        const fileExt = path.extname(document.file_name) || '.jpg';
        const filePath = path.join(TEMP_DIR, `input_${Date.now()}${fileExt}`);
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
        
        // Download file
        const response = await fetch(fileUrl);
        const buffer = await response.arrayBuffer();
        await fs.writeFile(filePath, Buffer.from(buffer));
        
        // Get image metadata
        const metadata = await sharp(filePath).metadata();
        
        userStates.set(chatId, {
            filePath,
            originalFormat: metadata.format,
            width: metadata.width,
            height: metadata.height,
            size: metadata.size
        });
        
        await showFormatOptions(chatId);
    } catch (error) {
        console.error('Error processing document:', error);
        await bot.sendMessage(chatId, '❌ Error processing image. Please try again.');
    }
});

// Show format selection
async function showFormatOptions(chatId) {
    const options = OUTPUT_FORMATS.map(format => ({
        text: format.toUpperCase(),
        callback_data: `convert_${format}`
    }));
    
    // Create keyboard rows (3 per row)
    const keyboard = [];
    for (let i = 0; i < options.length; i += 3) {
        keyboard.push(options.slice(i, i + 3));
    }
    keyboard.push([{ text: '❌ Cancel', callback_data: 'cancel' }]);
    
    try {
        await bot.sendMessage(chatId, '🔄 Select output format:', {
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    } catch (error) {
        console.error('Error showing format options:', error);
    }
}

// Handle callback queries
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    try {
        if (data === 'cancel') {
            const state = userStates.get(chatId);
            if (state && state.filePath) {
                await fs.unlink(state.filePath).catch(() => {});
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
                await bot.sendMessage(chatId, '❌ No image found. Please send an image first.');
                await bot.answerCallbackQuery(query.id);
                return;
            }
            
            await bot.answerCallbackQuery(query.id, `Converting to ${format.toUpperCase()}...`);
            await convertImage(chatId, format);
        }
    } catch (error) {
        console.error('Error in callback query:', error);
        await bot.answerCallbackQuery(query.id, '❌ Error processing request');
    }
});

// Convert image
async function convertImage(chatId, outputFormat) {
    const state = userStates.get(chatId);
    
    if (!state || !state.filePath) {
        await bot.sendMessage(chatId, '❌ No image found. Please send an image first.');
        return;
    }
    
    try {
        await bot.sendMessage(chatId, `🔄 Converting to ${outputFormat.toUpperCase()}...`);
        
        const inputPath = state.filePath;
        const outputPath = path.join(TEMP_DIR, `output_${Date.now()}.${outputFormat}`);
        
        // Perform conversion
        const pipeline = sharp(inputPath);
        
        switch (outputFormat) {
            case 'png':
                await pipeline.png({ quality: 100 }).toFile(outputPath);
                break;
            case 'jpeg':
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
        
        // Send converted image
        await bot.sendDocument(chatId, outputPath, {
            caption: `
✅ Conversion Complete!

📄 Format: ${outputFormat.toUpperCase()}
📦 Size: ${(stats.size / 1024).toFixed(1)} KB
📐 Resolution: ${state.width}×${state.height}

Send another image to convert again!
            `
        });
        
        // Cleanup
        await fs.unlink(inputPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
        userStates.delete(chatId);
        
    } catch (error) {
        console.error('Error converting image:', error);
        await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
        
        // Cleanup on error
        if (state.filePath) {
            await fs.unlink(state.filePath).catch(() => {});
        }
        userStates.delete(chatId);
    }
}

// Error handling
bot.on('error', (error) => {
    console.error('Bot error:', error);
});

bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        bot.stopPolling();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    server.close(() => {
        bot.stopPolling();
        process.exit(0);
    });
});

console.log('✅ Bot is running!');
console.log(`📊 Health check: http://localhost:${PORT}/health`);
