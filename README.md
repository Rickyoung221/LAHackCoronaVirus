![14121616141392_ pic_hd](https://user-images.githubusercontent.com/55896677/111750002-d73fab00-884f-11eb-98ff-b87a635cf06a.jpg)

# LA Hack Corona Virus (2020 LA Hackathon)

**Team:** @Rickyoung221, @terranzmczmx, @annyzy, @walterli97, @Zeyu Wang

Originally a hackathon project to help people spot supermarkets in more severely affected areas and get infection- and distance-aware suggestions.

The repo now includes **LA Markets Near You** (`Homepage.htm`): L.A. certified retail food markets on a map from [L.A. open data](https://data.lacity.org/), address search, and a driving-distance ranking table.

---

## Google Maps setup

You need a [Google Maps Platform](https://developers.google.com/maps/documentation/javascript) API key with **billing** enabled on the project.

Enable these APIs for the **same** key (APIs & Services → Library):

| API | Why |
|-----|-----|
| **Maps JavaScript API** | Map + libraries |
| **Places API (New)** | Address autocomplete (`PlaceAutocompleteElement` → `places.googleapis.com`) |
| **Geocoding API** | “Go” button / free-text address lookup |
| **Routes API** | Driving-distance table via `RouteMatrix` (recommended) |
| **Distance Matrix API** | Optional fallback if Routes API is not enabled |

For production maps with **Advanced Markers**, create a **Map ID** in Cloud Console → Map Management and set `MAP_ID` in `js/homepage-map.js` (see comments there). The default `DEMO_MAP_ID` is fine for demos.

Details mirror `.env.example`.

---

## Run locally (recommended)

Uses the build step to inject your key from `.env.local` into HTML.

```bash
npm install
cp .env.example .env.local
# Edit .env.local: set GOOGLE_MAP_PLATFORM=your_api_key
npm run dev
```

Then open the URL Browser Sync prints (e.g. **http://localhost:3000**). The site is served from `dist/` with `Homepage.htm` also available as **`/Homepage.htm`**.

Other scripts:

- `npm run build` — copy assets to `dist/` and replace `__GOOGLE_MAPS_API_KEY__` with `GOOGLE_MAP_PLATFORM`
- `npm run preview` / `npm run serve:dist` — serve `dist/` on port **8080** after a build

---

## Run without npm (quick test)

```bash
python3 -m http.server
```

Open `http://localhost:8000/Homepage.htm`. You must **manually replace** the placeholder `__GOOGLE_MAPS_API_KEY__` in `Homepage.htm` (and any other HTML that loads Maps), or the map will not load.

---

## Deploy (e.g. Vercel)

Set the environment variable **`GOOGLE_MAP_PLATFORM`** to your browser Maps API key. The build injects it into static HTML (see `scripts/build-static.js`).

---

## Enjoy ;)
