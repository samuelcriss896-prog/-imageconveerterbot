# Image Converter Telegram Bot

A Telegram bot that converts images between different formats using Node.js and Sharp.

## Features

- Convert images between PNG, JPEG, WEBP, TIFF, AVIF, and HEIF formats
- Handle both photos and document images
- High-quality conversion preserving image resolution
- Simple and intuitive interface

## Commands

- `/start` - Start the bot and see welcome message
- `/help` - Show help information
- `/formats` - Show supported formats
- `/cancel` - Cancel current operation

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env` file with your bot token
4. Run locally: `npm start`

## Deployment on Railway

1. Push code to GitHub
2. Connect your GitHub repository to Railway
3. Add environment variable `BOT_TOKEN`
4. Deploy

## Environment Variables

- `BOT_TOKEN`: Your Telegram bot token from @BotFather
- `PORT`: Port for the web server (default: 3000)

## Tech Stack

- Node.js
- Telegram Bot API
- Sharp (image processing)
- Express
- Docker
