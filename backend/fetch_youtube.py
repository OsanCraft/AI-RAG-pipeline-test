import os
import re
from youtube_transcript_api import YouTubeTranscriptApi

def get_video_id(url):
    """Extracts the unique video ID from various YouTube URL formats."""
    pattern = r'(?:v=|\/)([0-9A-Za-z_-]{11}).*'
    match = re.search(pattern, url)
    return match.group(1) if match else None

def download_youtube_transcript(url, output_folder="./contextfolder"):
    """Downloads a YouTube transcript and saves it as a clean text file."""
    video_id = get_video_id(url)
    if not video_id:
        print("❌ Invalid YouTube URL format!")
        return

    os.makedirs(output_folder, exist_ok=True)
    output_path = os.path.join(output_folder, f"youtube_{video_id}.txt")

    try:
        print(f"📥 Fetching transcript for video ID: {video_id}...")

        # v1.x API: instantiate the class, then call .fetch()
        ytt_api = YouTubeTranscriptApi()
        fetched_transcript = ytt_api.fetch(video_id)

        # fetched_transcript is iterable; each item is a snippet object with .text
        full_text = " ".join(snippet.text for snippet in fetched_transcript)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(full_text)

        print(f"✅ Success! Saved transcript to: {output_path}")

    except Exception as e:
        print(f"❌ Error downloading transcript: {e}")
        print("Note: Ensure the video has closed captions/subtitles enabled.")

if __name__ == "__main__":
    video_url = input("🔗 Enter YouTube Video URL: ")
    download_youtube_transcript(video_url)
