# Quartz404DidYouMean
Smarter 404s for Quartz: case-insensitive fuzzy suggestions ([Levenshtein](https://en.wikipedia.org/wiki/Levenshtein_distance)), works under subpaths, no server required.

_NOTE: This was vibe coded with an LLM - there might be bugs! - but it seems to work for me. If you have any trouble using it please open an issue because it's probably buggy for me too and I have just not noticed._

This adds a Quartz-native 404 that suggests the closest existing page. Case changes are free; edits/inserts/deletes cost 1. (This is a form of [Levenshtein distance](https://en.wikipedia.org/wiki/Levenshtein_distance)!) It pulls candidates from contentIndex.json (root or /static/), falls back to sitemap.xml (incl. sitemap indexes / namespaces), then an optional pages.json, then last-ditch link scraping. Works with SPA or non-SPA - just an inline script that gets bundled into postscript.js.

<div align="center">
<img width="505" height="410" alt="image" src="https://github.com/user-attachments/assets/77738946-4b6a-465f-a119-bcf03175f904" />
</div>


Features:
- Case-insensitive matching; fast path for case-only mismatches.
- CI-Levenshtein (O(min(n,m)) memory) with sane thresholds.
- Adds extra question marks to the end if the closest page is very different?????

<div align="center">
  <img width="551" height="412" alt="image" src="https://github.com/user-attachments/assets/282c1db5-fe91-4dd9-9a9f-3967503aa97e" />
</div>


Installation:
1. Copy/merge the "quartz" folder in this repo into where you have Quartz installed, so the new content for the components and plugins folders get added.
2. Edit your existing quartz/plugins/emitters/index.ts file to include the custom not found page, editing it as per the example in quartz/plugins/emitters/INDEX-EDIT.ts. (Delete the example when done.)
3. Edit your existing quartz.config.ts file in your root quartz folder as per the example in QUARTZ-CONFIG-EDIT.ts.
4. Recompile and deploy your site!
