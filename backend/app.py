"""
Flask Backend for Filler Word Detection with Whisper
Run this locally on your PC with: python app.py
"""
import os
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper

app = Flask(__name__)
CORS(app)

# Load Whisper model (loads once on startup)
print("Loading Whisper model... This may take a moment on first run.")
model = whisper.load_model("large-v3")
print("Whisper model loaded successfully!")

# Filler words to include in initial prompt for better detection
FILLER_WORDS_PROMPT = "um, uh, er, ah, hmm, like, so, you know, I mean, kind of, sort of, basically, actually, literally, right, okay, well, anyway"


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "model": "whisper-large-v3"})


@app.route('/transcribe', methods=['POST'])
def transcribe():
    """
    Transcribe audio/video file with filler word preservation
    Accepts multipart form data with 'file' field
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    try:
        # Save uploaded file temporarily
        suffix = os.path.splitext(file.filename)[1] or '.webm'
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name
        
        print(f"Processing file: {file.filename}")
        
        # Transcribe with settings optimized for filler word preservation
        result = model.transcribe(
            tmp_path,
            language="en",
            task="transcribe",
            # Key settings for filler word preservation:
            initial_prompt=f"This is a transcription with filler words: {FILLER_WORDS_PROMPT}",
            temperature=0.0,  # Deterministic output
            no_speech_threshold=0.3,  # Lower threshold to catch more speech
            word_timestamps=True,  # Enable word-level timestamps
            condition_on_previous_text=True,  # Better context
        )
        
        # Clean up temp file
        os.unlink(tmp_path)
        
        transcript = result.get("text", "").strip()
        
        # Also return word-level data if available
        segments = result.get("segments", [])
        words = []
        for segment in segments:
            if "words" in segment:
                words.extend(segment["words"])
        
        print(f"Transcription complete: {len(transcript)} characters")
        
        return jsonify({
            "success": True,
            "transcript": transcript,
            "words": words,  # Word-level timestamps
            "language": result.get("language", "en")
        })
        
    except Exception as e:
        print(f"Transcription error: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route('/analyze', methods=['POST'])
def analyze_fillers():
    """
    Analyze text for filler words
    Accepts JSON with 'text' and optional 'level' (conservative, medium, aggressive)
    """
    data = request.get_json()
    
    if not data or 'text' not in data:
        return jsonify({"error": "No text provided"}), 400
    
    text = data['text']
    level = data.get('level', 'medium')
    
    # Filler word lists by level
    FILLERS = {
        'hesitation': ['um', 'uh', 'er', 'ah', 'hmm', 'mm', 'mmm', 'hm', 'uhm', 'erm', 'umm', 'uhh', 'err', 'mhm', 'uh-huh', 'mm-hmm'],
        'crutches': ['like', 'so', 'well', 'right', 'okay', 'ok', 'actually', 'basically', 'literally', 'obviously', 'honestly', 'seriously', 'totally', 'definitely', 'probably', 'maybe', 'anyway', 'anyways'],
        'phrases': ['you know', 'i mean', 'kind of', 'sort of', 'or something', 'or whatever', 'and stuff', 'i guess', 'i think', 'you see', 'to be honest', 'the thing is']
    }
    
    # Get fillers based on level
    if level == 'conservative':
        fillers = FILLERS['hesitation']
    elif level == 'aggressive':
        fillers = FILLERS['hesitation'] + FILLERS['crutches'] + FILLERS['phrases']
    else:  # medium
        fillers = FILLERS['hesitation'] + FILLERS['crutches'][:5] + FILLERS['phrases'][:5]
    
    import re
    
    cleaned_text = text
    detected = []
    
    # Sort by length (longest first)
    sorted_fillers = sorted(fillers, key=len, reverse=True)
    
    for filler in sorted_fillers:
        pattern = re.compile(r'\b' + re.escape(filler) + r'\b', re.IGNORECASE)
        matches = pattern.finditer(text)
        for match in matches:
            detected.append({
                "word": match.group(),
                "start": match.start(),
                "end": match.end()
            })
        cleaned_text = pattern.sub(' ', cleaned_text)
    
    # Detect repeated words
    words = cleaned_text.split()
    deduped = []
    for i, word in enumerate(words):
        clean_word = re.sub(r'[^\w]', '', word.lower())
        prev_clean = re.sub(r'[^\w]', '', words[i-1].lower()) if i > 0 else ''
        if clean_word != prev_clean or len(clean_word) <= 1:
            deduped.append(word)
    
    cleaned_text = ' '.join(deduped)
    cleaned_text = re.sub(r'\s+', ' ', cleaned_text).strip()
    
    original_count = len(text.split())
    cleaned_count = len(cleaned_text.split())
    reduction = round((original_count - cleaned_count) / original_count * 100) if original_count > 0 else 0
    
    return jsonify({
        "success": True,
        "originalText": text,
        "cleanedText": cleaned_text,
        "fillersDetected": len(detected),
        "detectedFillers": detected,
        "stats": {
            "originalWordCount": original_count,
            "cleanedWordCount": cleaned_count,
            "reductionPercentage": reduction
        }
    })


if __name__ == '__main__':
    print("\n" + "="*50)
    print("Filler Word Removal Backend")
    print("="*50)
    print("Endpoints:")
    print("  GET  /health     - Health check")
    print("  POST /transcribe - Transcribe audio/video file")
    print("  POST /analyze    - Analyze text for filler words")
    print("="*50 + "\n")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
