import urllib.request
import re
from html import unescape

urls_to_crawl = [
    "https://briantsofrisborough.co.uk/product-category/garden-machinery/",
    "https://briantsofrisborough.co.uk/product-category/fencing-and-timber/",
    "https://briantsofrisborough.co.uk/product-category/arborist-equipment/",
    "https://briantsofrisborough.co.uk/product-category/ppe/",
    "https://briantsofrisborough.co.uk/brands/"
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}

all_links = set()

for url in urls_to_crawl:
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            html = resp.read().decode('utf-8')
            found = re.findall(r'href=[\"\'](https://briantsofrisborough\.co\.uk/[^\"\']+)[\"\']', html)
            for l in found:
                # filter category, brand, and service links
                if any(k in l for k in ['/product-category/', '/brands/', '/robotic-mowers/', '/machinery-repairs/']):
                    clean_url = l.split('?')[0].split('#')[0]
                    if clean_url.endswith('/'):
                        all_links.add(clean_url)
    except Exception as e:
        print(f"Error fetching {url}: {e}")

sorted_links = sorted(list(all_links))
print(f"TOTAL EXACT VERIFIED LINKS FOUND: {len(sorted_links)}\n")
for link in sorted_links:
    print(link)
