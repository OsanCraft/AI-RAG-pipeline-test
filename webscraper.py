import os
import re
import time
import requests
from bs4 import BeautifulSoup

# --- CONFIGURATION ---
WIKI_DOMAIN = "unstable-universe-mc.fandom.com"
API_URL = f"https://{WIKI_DOMAIN}/api.php"
OUTPUT_DIR = "./raw_scrapes"
REQUEST_DELAY = 1.0  # seconds between requests - be polite, don't hammer their server

# A real, honest User-Agent identifying what this is. Sites block requests with no
# User-Agent or the generic default one, since that's a classic bot fingerprint.
HEADERS = {
    "User-Agent": "PersonalResearchBot/1.0 (local RAG project; contact: nullitly@gmail.com)"
}


def get_all_page_titles():
    """Uses the MediaWiki API to fetch every article title on the wiki, handling pagination."""
    titles = []
    params = {
        "action": "query",
        "list": "allpages",
        "aplimit": "500",       # max allowed per request
        "apnamespace": "0",     # namespace 0 = main content articles only, skips Talk:/User:/Category: pages
        "format": "json"
    }

    while True:
        response = requests.get(API_URL, params=params, headers=HEADERS)
        response.raise_for_status()
        data = response.json()

        pages = data.get("query", {}).get("allpages", [])
        titles.extend(page["title"] for page in pages)

        # The API tells us if there are more pages to paginate through
        if "continue" in data:
            params["apcontinue"] = data["continue"]["apcontinue"]
            time.sleep(REQUEST_DELAY)
        else:
            break

    return titles


def get_page_text(title):
    """Fetches the rendered content of one page and strips it down to plain text."""
    params = {
        "action": "parse",
        "page": title,
        "prop": "text",
        "format": "json"
    }

    response = requests.get(API_URL, params=params, headers=HEADERS)
    response.raise_for_status()
    data = response.json()

    if "error" in data:
        return None

    html_content = data["parse"]["text"]["*"]

    # The API returns rendered HTML (same as the page itself), so we strip tags,
    # navigation boxes, and reference markers down to clean readable text.
    soup = BeautifulSoup(html_content, "html.parser")

    # Remove common non-content elements Fandom pages include. Fandom uses its own
    # "Portable Infobox" system (renders as <aside class="portable-infobox">) rather
    # than the generic MediaWiki .infobox class, and episode-nav footers usually carry
    # a wiki-specific class rather than the generic .navbox - so we match on partial
    # class names ([class*="..."]) instead of exact ones to catch these variants too.
    noise_selectors = (
        "aside.portable-infobox, "
        '[class*="infobox"], '
        '[class*="navbox"], '
        '[class*="navigation"], '
        "nav, "
        ".reference, "
        ".mw-editsection, "
        "table.toc, "
        ".wikia-gallery, "
        ".category-page__members"
    )
    for element in soup.select(noise_selectors):
        element.decompose()

    text = soup.get_text(separator="\n")

    # Collapse excessive blank lines left behind after stripping elements
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    return text


def sanitize_filename(title):
    """Converts a wiki page title into a safe filename."""
    return re.sub(r"[^\w\-]", "_", title) + ".txt"


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"📚 Fetching full page list from {WIKI_DOMAIN}...")
    titles = get_all_page_titles()
    print(f"✅ Found {len(titles)} pages.")

    for i, title in enumerate(titles, start=1):
        print(f"  [{i}/{len(titles)}] Fetching: {title}")

        try:
            text = get_page_text(title)
        except requests.exceptions.RequestException as e:
            print(f"    ❌ Network error on '{title}': {e}")
            continue

        if not text:
            print(f"    ⚠️  Skipped '{title}' (no content or API error)")
            continue

        filename = sanitize_filename(title)
        output_path = os.path.join(OUTPUT_DIR, filename)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(text)

        time.sleep(REQUEST_DELAY)  # stay polite between requests

    print(f"\n✅ Done. Saved {len(titles)} pages to {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()