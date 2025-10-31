import pandas as pd
import sys
import plotly.graph_objs as go
import plotly.io as pio

try:
    title = sys.argv[3]
    csv_path = sys.argv[1]
    out_path = sys.argv[2]
except IndexError:
    print("Usage: python points_tracker.py <csv_path> <out_path> <title>")
    sys.exit(1)
round_boundaries = [
    # {'round': "Miami.1", 'label': "Round 1"},
    # {'round': "UK", 'label': "Round 2"},
    # {'round': "Singapore", 'label': "Round 3"},
    # {'round': "Abu Dhabi", 'label': "Round 4"}
]

# Read CSV and set index
df = pd.read_csv(csv_path, header=0, index_col=0).T
# df.set_index('round', inplace=True)

# Calculate running totals
running_totals = df.cumsum()

# Create traces for each participant with hover text
traces = []
for player in running_totals.columns:
    traces.append(
        go.Scatter(
            x=running_totals.index,
            y=running_totals[player],
            mode="lines+markers",
            name=player,
            # text = [f"<b>{player}</b>: {df.loc[rnd, player]}<br>Total: {points}"
            #       for i, (rnd, points) in enumerate(zip(running_totals.index, running_totals[player]))],
            text=[
                f"<b>{player} Total: {points}</b><br><i>{rnd} Points:</i> {df.loc[rnd, player]}<br><i>Standings after Round {i}:</i><br>"
                + "<br>".join(
                    [
                        f"\t\t{p}: {running_totals.loc[rnd, p]}"
                        for p in sorted(
                            running_totals,
                            key=lambda x: running_totals.loc[rnd, x],
                            reverse=True,
                        )
                    ]
                )
                for i, (rnd, points) in enumerate(
                    zip(running_totals.index, running_totals[player])
                )
            ],
            hoverinfo="text",
        )
    )

# Add round boundaries if any
for boundary in round_boundaries:
    traces.append(
        go.Scatter(
            x=[boundary["round"], boundary["round"]],
            y=[0, running_totals.values.max()],
            mode="lines",
            line=dict(color="grey", dash="dot"),
            name=boundary["label"],
            showlegend=False,
        )
    )

# Create layout
layout = go.Layout(
    title=title,
    xaxis=dict(title="Round", tickangle=-45),
    yaxis=dict(title="Cumulative Scores"),
    hovermode="closest",  # change to x / closest to use other text
)

# Create figure
fig = go.Figure(data=traces, layout=layout)

# Save as interactive HTML
pio.write_html(fig, file=out_path, auto_open=True, include_plotlyjs="cdn")

print(f"Interactive visualization saved as {out_path}")
