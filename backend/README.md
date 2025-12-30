# Filler Word Removal - Flask Backend

This Flask backend provides Whisper-based transcription with filler word preservation.

## Setup

1. **Install Python 3.9+** (recommended: 3.10 or 3.11)

2. **Create a virtual environment:**
   ```bash
   cd backend
   python -m venv venv
   
   # Windows
   venv\Scripts\activate
   
   # Mac/Linux
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Install FFmpeg** (required for audio processing):
   - Windows: `choco install ffmpeg` or download from https://ffmpeg.org
   - Mac: `brew install ffmpeg`
   - Linux: `sudo apt install ffmpeg`

## Running the Server

```bash
python app.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### Health Check
```
GET /health
```
Returns server status.

### Transcribe Audio/Video
```
POST /transcribe
Content-Type: multipart/form-data

file: <audio or video file>
```

Returns:
```json
{
  "success": true,
  "transcript": "The transcribed text...",
  "words": [...],  // Word-level timestamps
  "language": "en"
}
```

### Analyze Text for Fillers
```
POST /analyze
Content-Type: application/json

{
  "text": "Um, so I was like, you know, thinking...",
  "level": "medium"  // conservative, medium, or aggressive
}
```

Returns:
```json
{
  "success": true,
  "originalText": "...",
  "cleanedText": "...",
  "fillersDetected": 4,
  "stats": {
    "originalWordCount": 10,
    "cleanedWordCount": 6,
    "reductionPercentage": 40
  }
}
```

## Connecting to Lovable Frontend

1. Start this backend on your PC
2. In the Lovable project, set the environment variable:
   ```
   VITE_BACKEND_URL=http://localhost:5000
   ```
   Or use your PC's IP address if accessing from another device:
   ```
   VITE_BACKEND_URL=http://192.168.x.x:5000
   ```

## GPU Acceleration

For faster transcription, install CUDA-enabled PyTorch:
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```
