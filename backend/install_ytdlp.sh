#!/bin/bash

# Update and install Python3 and PIP
echo "📦 Installing Python3 and FFmpeg..."
sudo apt-get update
sudo apt-get install -y python3 python3-pip ffmpeg

# Install yt-dlp
echo "⬇️ Installing yt-dlp..."
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Verify installation
echo "✅ Verifying yt-dlp..."
yt-dlp --version

echo "🎉 Installation Complete!"
