// pointsTracker.js
// Exported functions: parseCsv, parsePointsTable, cumulativeSums, buildPlotlyTraces,
// createBoundaryTraces, makePlotlyFigure, processCsvToFigure

// Helper: parse CSV text into rows (array of arrays), handles quoted fields.
function parseCsv(csvText, delimiter = ',') {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < csvText.length) {
        const ch = csvText[i];

        if (inQuotes) {
            if (ch === '"') {
                // Lookahead for escaped quote
                if (i + 1 < csvText.length && csvText[i + 1] === '"') {
                    field += '"';
                    i += 2;
                    continue;
                } else {
                    inQuotes = false;
                    i++;
                    continue;
                }
            } else {
                field += ch;
                i++;
                continue;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
                i++;
                continue;
            } else if (ch === delimiter) {
                row.push(field);
                field = '';
                i++;
                continue;
            } else if (ch === '\r') {
                // ignore, handle with \n
                i++;
                continue;
            } else if (ch === '\n') {
                row.push(field);
                rows.push(row);
                row = [];
                field = '';
                i++;
                continue;
            } else {
                field += ch;
                i++;
                continue;
            }
        }
    }

    // push last
    if (field !== '' || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows;
}

// Parse points table: expects first column to be round name, header row with player names
// New orientation: CSV is transposed compared to original script.
// Expected format now: columns are round names (header row), rows are participants.
// Example:
// ,Round1,Round2
// Alice,10,6
// Bob,8,9
// Returns: { rounds: [...], players: [...], pointsByPlayer: {player: [numbers per round], tableRows: [{player, values...}] } }
function parsePointsTable(csvText, delimiter = ',') {
    const rows = parseCsv(csvText, delimiter);
    if (rows.length === 0) {
        return {
            rounds: [],
            players: [],
            pointsByPlayer: {},
            tableRows: []
        };
    }

    const header = rows[0].map(h => (h == null ? '' : String(h).trim()));
    // Header's first cell is expected to be empty or a label for the player column
    const rounds = header.slice(1).map((h, i) => h || `Round ${i + 1}`);

    const players = [];
    const pointsByPlayer = {};
    const tableRows = []; // { player: string, values: [v1, v2, ...] }

    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (row.length === 0 || row.every(cell => (cell || '').trim() === '')) {
            continue;
        }
        const playerName = (row[0] != null ? String(row[0]).trim() : `Player ${r}`);
        players.push(playerName);
        const vals = [];
        for (let c = 1; c < header.length; c++) {
            const raw = (row[c] != null ? row[c] : '').toString().trim();
            const num = raw === '' ? 0 : Number(raw.replace(/,/g, ''));
            const val = Number.isFinite(num) ? num : 0;
            vals.push(val);
        }
        pointsByPlayer[playerName] = vals;
        tableRows.push({ player: playerName, values: vals });
    }

    return { rounds, players, pointsByPlayer, tableRows };
}

// Compute cumulative sums per player
// Input: pointsByPlayer: {player: [numbers...]}
// Output: runningTotals: {player: [cumulative numbers...]}
function cumulativeSums(pointsByPlayer) {
    const running = {};
    for (const player of Object.keys(pointsByPlayer)) {
        const vals = pointsByPlayer[player];
        const cum = [];
        let s = 0;
        for (let i = 0; i < vals.length; i++) {
            s += Number(vals[i]) || 0;
            cum.push(s);
        }
        running[player] = cum;
    }
    return running;
}

// Build Plotly traces replicating the Python hover layout and data
// runningTotals: {player: [cum...]} ; pointsByPlayer: {player: [per-round...]}; rounds: [labels]
// options: {lineWidth, markerSize, roundBoundaries: [{round: label, label: label}], showLegend}
function buildPlotlyTraces(runningTotals, pointsByPlayer, rounds, options = {}) {
    const players = Object.keys(runningTotals);
    const traces = [];
    const nRounds = rounds.length;

    // Precompute y max
    let yMax = Number.NEGATIVE_INFINITY;
    for (const p of players) {
        for (const v of runningTotals[p]) {
            if (v > yMax) yMax = v;
        }
    }
    if (!Number.isFinite(yMax)) yMax = 0;

    // Accept a color palette in options.palette (array of CSS colors). If not provided,
    // fall back to Plotly default-ish colors for light mode or a brighter set for dark mode.
    const palette = Array.isArray(options.palette) ? options.palette : null;

    players.forEach((player, idx) => {
        const color = palette ? palette[idx % palette.length] : undefined;
        const y = runningTotals[player].slice(0, nRounds);
        // Build hover text per point (string HTML)
        const text = y.map((points, i) => {
            // Round label for the point
            const rnd = rounds[i] || `Round ${i + 1}`;
            // Per-round points for that player:
            const roundPts = (pointsByPlayer[player] && pointsByPlayer[player][i] != null)
                ? pointsByPlayer[player][i]
                : 0;

            // Build standings: sort players by runningTotals at this round (descending)
            const standings = players
                .map(p => ({ p, val: (runningTotals[p] && runningTotals[p][i] != null) ? runningTotals[p][i] : 0 }))
                .sort((a, b) => b.val - a.val);

            const standingsHtml = standings.map(s => `${s.p}: ${s.val}`).join('<br>');
            // Format hover text similar to Python version
            return `<b>${player} Total: ${points}</b><br><i>${rnd} Points:</i> ${roundPts}<br><i>Standings after Round ${i + 1}:</i><br>${standingsHtml}`;
        });

        const trace = {
            x: rounds,
            y: y,
            mode: 'lines+markers',
            name: player,
            text: text,
            hoverinfo: 'text',
            line: { width: options.lineWidth || 2 },
            marker: { size: options.markerSize || 6 }
        };

        if (color) {
            trace.line.color = color;
            trace.marker.color = color;
        }

        traces.push(trace);
    });

    // Add round boundaries if provided
    if (Array.isArray(options.roundBoundaries) && options.roundBoundaries.length > 0) {
        options.roundBoundaries.forEach(boundary => {
            // boundary.round is expected to be a round label that exists in rounds
            const xVal = boundary.round;
            traces.push({
                x: [xVal, xVal],
                y: [0, yMax],
                mode: 'lines',
                line: { color: options.boundaryColor || 'grey', dash: 'dot' },
                name: boundary.label || boundary.round,
                showlegend: false,
                hoverinfo: 'none'
            });
        });
    }

    return traces;
}

// Create boundary traces separately if needed (accepts index-based or label-based boundaries)
function createBoundaryTraces(boundaries = [], rounds = [], yMax = 0) {
    // boundaries: [{round: 'RoundLabel', label: 'Round N'}]
    const traces = [];
    boundaries.forEach(b => {
        traces.push({
            x: [b.round, b.round],
            y: [0, yMax],
            mode: 'lines',
            line: { color: 'grey', dash: 'dot' },
            name: b.label || b.round,
            showlegend: false,
            hoverinfo: 'none'
        });
    });
    return traces;
}

// Make a Plotly figure config object
function makePlotlyFigure(traces, title = '', options = {}) {
    // Provide a slightly larger bottom/right margin by default so rotated x-tick labels
    // or a vertical legend on the right do not overlap or get clipped. Caller may override
    // by providing options.margin. By default place the legend to the right of the plot
    // (vertical) which keeps the x-axis area clear.
    const defaultMargin = { t: 80, r: 180, b: 120, l: 60 };
    const margin = options.margin || defaultMargin;

    // Legend placement: allow caller to request 'right' (vertical right-side legend)
    // or fallback to a horizontal legend (old behavior). The user can also pass
    // `options.legendOrientation` to force a specific orientation.
    let legend = {};
    if (options.legendPosition === 'right' || (!options.legendOrientation && options.legendPosition !== 'bottom')) {
        legend = {
            orientation: 'v',
            x: 1.02,
            y: 1,
            xanchor: 'left'
        };
    } else {
        legend = { orientation: options.legendOrientation || 'h' };
    }

    // Theme-aware layout defaults. Caller can pass options.theme = 'light'|'dark' or
    // we will infer from options.isLight boolean.
    const isLight = (options.theme === 'light') || (options.isLight === true);
    const paperBg = isLight ? '#ffffff' : '#0b1220';
    const plotBg = isLight ? '#ffffff' : '#071423';
    const fontColor = isLight ? '#111827' : '#e6eef8';
    const gridColor = isLight ? 'rgba(17,24,39,0.06)' : 'rgba(230,238,248,0.06)';

    const layout = {
        title: title,
        paper_bgcolor: paperBg,
        plot_bgcolor: plotBg,
        font: { color: fontColor },
        xaxis: {
            title: 'Round',
            tickangle: -45,
            gridcolor: gridColor,
            zerolinecolor: gridColor,
            color: fontColor
        },
        yaxis: { title: 'Cumulative Scores', gridcolor: gridColor, color: fontColor },
        hovermode: options.hovermode || 'closest',
        legend,
        margin
    };
    return { data: traces, layout };
}

// Convenience function: full pipeline from CSV text to Plotly figure object
// opts: {delimiter, title, lineWidth, markerSize, roundBoundaries, hovermode, legendOrientation}
function processCsvToFigure(csvText, opts = {}) {
    const delimiter = opts.delimiter || ',';
    const { rounds, players, pointsByPlayer } = parsePointsTable(csvText, delimiter);
    const runningTotals = cumulativeSums(pointsByPlayer);
    // Detect theme from the document (if running in browser) unless caller provided opts.theme
    let isLight = false;
    try {
        if (typeof document !== 'undefined') {
            isLight = document.documentElement.classList.contains('light') || document.body.classList.contains('light');
        }
    } catch (e) {
        isLight = false;
    }

    // Default palettes: light (classic Plotly-like) and dark (brighter/softer on dark bg)
    const lightPalette = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];
    const darkPalette = ['#63a0ff', '#ffa94d', '#7be07b', '#ff7b7b', '#bfa0ff', '#d6a78f', '#ff9ad8', '#bdbdbd', '#fff07a', '#57e7ef'];

    const palette = opts.palette || (isLight ? lightPalette : darkPalette);

    const traces = buildPlotlyTraces(runningTotals, pointsByPlayer, rounds, {
        lineWidth: opts.lineWidth,
        markerSize: opts.markerSize,
        roundBoundaries: opts.roundBoundaries,
        showLegend: opts.showLegend,
        palette: palette,
        boundaryColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'
    });

    const figure = makePlotlyFigure(traces, opts.title || '', {
        hovermode: opts.hovermode,
        legendOrientation: opts.legendOrientation,
        // pass through legendPosition and margin so callers can control placement
        legendPosition: opts.legendPosition,
        margin: opts.margin,
        isLight: isLight
    });
    return { figure, runningTotals, pointsByPlayer, rounds, players };
}

// Export for ESM environment:
export {
    parseCsv,
    parsePointsTable,
    cumulativeSums,
    buildPlotlyTraces,
    createBoundaryTraces,
    makePlotlyFigure,
    processCsvToFigure
};

// For UMD/CommonJS environments you can attach to window or module.exports as needed:
// (example - uncomment if not using ESM)
// if (typeof window !== 'undefined') window.pointsTracker = { parseCsv, parsePointsTable, cumulativeSums, buildPlotlyTraces, createBoundaryTraces, makePlotlyFigure, processCsvToFigure };
// if (typeof module !== 'undefined') module.exports = { parseCsv, parsePointsTable, cumulativeSums, buildPlotlyTraces, createBoundaryTraces, makePlotlyFigure, processCsvToFigure };
