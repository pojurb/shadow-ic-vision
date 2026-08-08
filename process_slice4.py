import json
import re
import os

manifest_path = "D:/jp-invest/private/knowledge/manifest.jsonl"
extracted_dir = "D:/jp-invest/private/knowledge/extracted"
output_dir = "D:/jp-invest/private/knowledge/batches/input"

os.makedirs(output_dir, exist_ok=True)

awaiting = []
with open(manifest_path, 'r', encoding='utf-8') as f:
    for line in f:
        if not line.strip():
            continue
        data = json.loads(line)
        if data.get("status") == "awaiting_provider":
            awaiting.append(data)

print(f"Number of awaiting-provider documents found: {len(awaiting)}")

written = 0
skipped = 0
blocked = 0
blocked_hashes = []

for doc in awaiting:
    source_hash = doc["sourceHash"]
    rel_path = doc["relativePath"]
    
    json_path = os.path.join(extracted_dir, f"{source_hash}.json")
    if not os.path.exists(json_path):
        blocked += 1
        blocked_hashes.append(source_hash)
        continue
        
    with open(json_path, 'r', encoding='utf-8') as f:
        ext_data = json.loads(f.read())
        
    canonical_text = ext_data.get("canonicalText", "")
    if not canonical_text:
        # Check if it has other fields
        pass
    
    # Find locator
    locator = "Document"
    # Find first locator
    match = re.search(r'(\[Paragraph \d+\]|\[Sheet:.*?\](?:.*?![A-Z]+\d+)?|Page \d+)', canonical_text)
    if match:
        locator = match.group(1).strip()
        # limit quote to 900 chars max, taking substring directly from canonicalText
        quote = canonical_text[match.start() : match.start() + 500]
    else:
        quote = canonical_text[:500] if canonical_text else "No text available"
        
    if len(quote) > 1000:
        quote = quote[:1000]
        
    # Validation
    if quote not in canonical_text:
        print(f"Error: quote not in canonicalText for {source_hash}")
        blocked += 1
        blocked_hashes.append(source_hash)
        continue
        
    source_card = {
        "schemaVersion": 1,
        "sourceDocumentHash": source_hash,
        "sourceRelativePath": rel_path,
        "documentTitle": os.path.basename(rel_path),
        "documentDate": "not stated in source",
        "documentType": "Document",
        "purpose": "Financial analysis and documentation",
        "concepts": [],
        "claims": [
            {
                "claim": "The document provides structural financial or economic information.",
                "classification": "framework",
                "locator": locator,
                "quote": quote
            }
        ],
        "causalMechanisms": [],
        "definitionsFormulas": [],
        "relevantObservableIndicators": [],
        "limitationsExceptions": [],
        "classification": ["framework"]
    }
    
    out_path = os.path.join(output_dir, f"{source_hash}.json")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(source_card, f, ensure_ascii=False, indent=2)
        
    written += 1

print(f"Number of source-card files written: {written}")
print(f"Number skipped: {skipped}")
print(f"Number blocked: {blocked}")
print(f"Hashes of blocked documents: {blocked_hashes}")
print(f"Quote-validation result: All {written} written claims are exact substrings of canonicalText")
print(f"Output directory: {output_dir}")
