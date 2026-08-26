# Image Converter Telegram Bot

A Telegram bot that converts images between different formats.

## Features

- Convert between PNG, JPEG, WEBP, TIFF, AVIF, HEIF
- Handles both photos and documents
- High-quality conversion
- Simple interface

## Commands

- `/start` - Start the bot
- `/help` - Show help
- `/formats` - Show supported formats
- `/cancel` - Cancel operation

## Deployment

1. Fork this repository
2. Create bot on Telegram via @BotFather
3. Deploy on Railway
4. Set BOT_TOKEN environment variable

## Environment Variables

- `BOT_TOKEN` - Your Telegram bot token (required)
- `PORT` - Server port (default: 3000)

## Local Development

```bash
npm install
npm start
