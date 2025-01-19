# TikTok Profile Video Downloader 2025

A robust Node.js script to download all videos from a TikTok profile. This tool uses Puppeteer with stealth mode to bypass TikTok's anti-bot measures and download videos in their original quality.

## Features

- 🚀 Downloads all videos from a TikTok profile
- 🔄 Automatic retry mechanism for failed downloads
- 🎯 Handles duplicates and ensures unique downloads
- 📊 Detailed progress logging
- 🛡️ Uses stealth mode to bypass TikTok's anti-bot measures
- ⚡ Supports video quality selection
- 🔍 Tracks successful and failed downloads

## Prerequisites

- Node.js (v14 or higher)
- Google Chrome browser installed
- Any operating system (Windows, macOS, or Linux)

## Installation

1. Clone this repository:

```bash
git clone https://github.com/yourusername/tiktok-profile-downloader
cd tiktok-profile-downloader
```

2. Install dependencies:

```bash
npm install
```

3. Update Chrome path:
   In `index.js`, update the Chrome executable path according to your operating system:

```javascript
executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", // use it accordingly your os executablePath: '/path/to/Chrome'
```

Common Chrome paths by OS:

- Windows: `C:/Program Files/Google/Chrome/Application/chrome.exe`
- macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- Linux: `/usr/bin/google-chrome` or `/usr/bin/chromium-browser`

You can find your Chrome executable path by:

- Windows: Right-click Chrome shortcut → Properties → Target field
- macOS: The default path is usually correct
- Linux: Run `which google-chrome` or `which chromium-browser` in terminal

## Usage

1. Run the script with a TikTok profile URL:

```javascript
// In index.js, replace @username with the target TikTok profile
const response = await runPuppeteer("https://www.tiktok.com/@username");
```

2. Execute the script:

```bash
node index.js
```

The script will:

- Scroll through the profile to load all videos
- Download videos to a `downloads` folder
- Create a `test.json` file with download results
- Show progress and any errors in the console

## Configuration

You can modify these parameters in the code:

- `maxRetries`: Number of retry attempts for failed downloads (default: 3)
- `retryDelay`: Delay between retries in milliseconds (default: 2000)
- `maxScrollAttempts`: Maximum scroll attempts to load videos (default: 50)

## Error Handling

The script includes robust error handling:

- Retries failed downloads automatically
- Validates file sizes to ensure complete downloads
- Handles network errors and redirects
- Provides detailed error logs for troubleshooting

## Output

- Videos are saved in the `downloads` folder as `xsavr_[videoId].mp4`
- Download results are saved in `test.json`
- Console output shows detailed progress and any errors

## Limitations

- Requires a stable internet connection
- May be affected by TikTok's rate limiting
- Some videos might be region-locked or private
- Chrome browser must be installed in the default location (or path updated accordingly)

## Contributing

Feel free to submit issues and enhancement requests!

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Legal Disclaimer

This tool is for educational purposes only. Make sure to comply with TikTok's terms of service and respect content creators' rights when using this tool.

## License

MIT License - see LICENSE file for details
