# Plot Cumulative Scores

This repository contains a small static demo and utilities for visualizing cumulative competition points across rounds. The browser UI accepts a CSV upload and renders an interactive Plotly chart that shows running totals per participant. The project also includes the original Python script used to generate similar charts from the command line.

## Repository contents

- `index.html` — A minimal, Tailwind-styled static page with a drag-and-drop CSV uploader, a bundled example dataset, and Plotly rendering.
- `pointsTracker.js` — JavaScript module that parses CSV input, computes running totals, and builds Plotly-compatible traces. Used by `index.html`.
- `points_tracker.py` — Original Python script that reads a CSV, computes cumulative totals using pandas, and writes an interactive HTML chart using Plotly.
- `public/bad_driver_2024.csv` — A bundled example dataset you can load from the demo UI.

## Quick start — run the demo locally

1. Serve the repository directory over HTTP (ES module imports require a server):

    ```bash
    # from the repository root
    python3 -m http.server 8000
    ```

2. Open the demo in your browser:

    `http://localhost:8000/index.html`

3. Use the page:

- Drop a CSV onto the dropzone or click the drop area to choose a file.
- Optionally edit the chart title.
- Click `Plot` (or click `Load example` to load and auto-plot the included demo dataset).

## Notes about the web demo

- The web demo expects a transposed CSV layout (columns = rounds, rows = participants). Example:

```csv
,Round1,Round2,Round3
Alice,10,6,5
Bob,8,9,7
Charlie,12,7,4
```

- The UI uses ES modules and must be served over HTTP (see "Quick start" above). Opening `index.html` via the `file://` protocol will cause module/CORS errors.
- The demo places the legend on the right by default and uses toast notifications instead of blocking alerts.
- For large or malformed CSVs consider replacing the built-in parser with a robust library such as PapaParse.

## Python script: `points_tracker.py`

The included `points_tracker.py` is the original script used to generate a similar interactive HTML chart from the command line. It uses `pandas` and `plotly`.

### Dependencies

- Python 3.8+
- pandas
- plotly

Install the Python dependencies (recommended in a virtualenv):

```bash
python3 -m pip install --user pandas plotly
```

### Usage

```bash
python points_tracker.py <csv_path> <out_path> <title>
```

### Example

```bash
python points_tracker.py data/points.csv out/chart.html "My Competition"
```

### Notes on CSV format for the Python script

```csv
,Alice,Bob,Charlie
Round1,10,8,12
Round2,6,9,7
```

- The script computes cumulative sums across rounds and writes an interactive HTML file via `plotly.io.write_html`.
- You can edit the `round_boundaries` list inside the script to programmatically add vertical boundary lines at specific rounds.

## Troubleshooting

- If `index.html` fails to load `pointsTracker.js` or the demo cannot fetch the example CSV, ensure you are serving the site over HTTP and that the server root is the repository root.
- If the Python script raises errors about missing packages, ensure `pandas` and `plotly` are installed in the Python environment being used.

## License

This repository is provided as-is for convenience. Feel free to adapt the code for your needs.
