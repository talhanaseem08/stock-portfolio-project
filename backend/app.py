# backend/app.py
from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import uuid
from matplotlib import pyplot as plt
import seaborn as sns

app = Flask(__name__)
CORS(app)

# in-memory store for uploaded datasets (token -> DataFrame)
DATASETS = {}

# ---------- helpers ----------
def _summarize_df(df: pd.DataFrame):
    out = {
        "rows": int(df.shape[0]),
        "cols": int(df.shape[1]),
        "columns": list(df.columns),
        "can_analyze": ("Close" in df.columns)
    }
    # try date info
    if "Date" in df.columns:
        try:
            d = pd.to_datetime(df["Date"])
            out["date_min"] = str(d.min().date())
            out["date_max"] = str(d.max().date())
        except Exception:
            pass
    return out

def _prep_prices(df: pd.DataFrame):
    df = df.copy()
    if "Date" in df.columns:
        try:
            df["Date"] = pd.to_datetime(df["Date"])
            df = df.sort_values("Date")
        except Exception:
            pass
    if "Close" in df.columns:
        df["Daily_Return"] = df["Close"].pct_change()
    return df

# ---------- health ----------
@app.route("/")
def home():
    return jsonify({"message": "API OK", "endpoints": ["/upload-csv", "/analyze/<token>/prices", "/analyze/<token>/metrics"]})

@app.route("/health")
def health():
    return jsonify({"ok": True})

# ---------- 1) UPLOAD CSV ----------
@app.route("/upload-csv", methods=["POST"])
def upload_csv():
    if "file" not in request.files:
        return jsonify({"error": "No file part 'file'"}), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "No file selected"}), 400
    try:
        df = pd.read_csv(f)
    except Exception as e:
        return jsonify({"error": f"Failed to read CSV: {e}"}), 400

    token = str(uuid.uuid4())[:8]
    DATASETS[token] = df

    summary = _summarize_df(df)
    preview = df.head(10).to_dict(orient="records")

    extra = {}
    if "Date" in df.columns:
        try:
            df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
            extra["Earliest Date"] = str(df["Date"].min().date()) if df["Date"].notnull().any() else None
            extra["Latest Date"] = str(df["Date"].max().date()) if df["Date"].notnull().any() else None
        except Exception:
            pass

    if "Close" in df.columns:
        extra["Max Close"] = float(df["Close"].max())
        extra["Min Close"] = float(df["Close"].min())

    if "Symbol" in df.columns:
        extra["Most Frequent Symbol"] = str(df["Symbol"].mode().iloc[0])

    # add to response
    return jsonify({
        "token": token,
        "summary": summary,
        "preview": preview,
        "extra": extra
    })


# ---------- 2) PRICES for an uploaded token ----------
@app.route("/analyze/<token>/prices")
def analyze_prices(token):
    if token not in DATASETS:
        return jsonify({"error": "Unknown token"}), 404
    df = _prep_prices(DATASETS[token])
    cols = [c for c in ["Date", "Open", "High", "Low", "Close", "Volume", "Daily_Return"] if c in df.columns]
    if not cols:
        return jsonify({"error": "No price-like columns found"}), 400
    # serialize dates
    if "Date" in cols and "Date" in df.columns and np.issubdtype(df["Date"].dtype, np.datetime64):
        df = df.copy()
        df["Date"] = df["Date"].dt.strftime("%Y-%m-%d")
    return jsonify(df[cols].to_dict(orient="records"))

# ---------- 3) METRICS (KPIs) for an uploaded token ----------
@app.route("/analyze/<token>/metrics")
def analyze_metrics(token):
    if token not in DATASETS:
        return jsonify({"error": "Unknown token"}), 404
    rf = float(request.args.get("rf", 0.01))  # annual risk-free, default 1%

    df = _prep_prices(DATASETS[token])
    if "Daily_Return" not in df.columns:
        return jsonify({"error": "CSV has no 'Close' column, cannot compute returns"}), 400

    avg_ret = float(df["Daily_Return"].mean())
    vol = float(df["Daily_Return"].std())
    rf_daily = rf / 252.0
    sharpe = None
    if vol and not pd.isna(vol) and vol != 0.0:
        sharpe = (avg_ret - rf_daily) / vol
    var95 = float(df["Daily_Return"].quantile(0.05))

    return jsonify({
        "Average Daily Return": round(avg_ret, 6) if not pd.isna(avg_ret) else None,
        "Volatility": round(vol, 6) if not pd.isna(vol) else None,
        "Sharpe Ratio": (round(sharpe, 3) if sharpe is not None else None),
        "VaR (95%)": round(var95, 4) if not pd.isna(var95) else None
    })

@app.route("/analyze/<token>/returns")
def analyze_returns(token):
    if token not in DATASETS:
        return jsonify({"error": "Invalid token"}), 404

    df = DATASETS[token]
    if "Close" not in df.columns or "Date" not in df.columns:
        return jsonify({"error": "Need Date and Close columns"}), 400

    df = df.sort_values("Date")
    df["Daily_Return"] = df["Close"].pct_change()
    df["Cumulative_Return"] = (1 + df["Daily_Return"]).cumprod()
    df["Rolling_Volatility"] = df["Daily_Return"].rolling(30).std()

    return jsonify({
        "hist": df["Daily_Return"].dropna().tolist()[:500],  # return limited for frontend
        "cumulative": df[["Date", "Cumulative_Return"]].dropna().to_dict(orient="records"),
        "volatility": df[["Date", "Rolling_Volatility"]].dropna().to_dict(orient="records")
    })

@app.route("/analyze/<token>/charts")
def analyze_charts(token):
    if token not in DATASETS:
        return jsonify({"error": "Invalid token"}), 404

    df = DATASETS[token].copy()
    if "Date" not in df.columns or "Close" not in df.columns:
        return jsonify({"error": "Dataset missing required columns"}), 400

    # Ensure proper date ordering
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df.sort_values("Date")

    # Chart 1: Price over time
    price_chart = df[["Date", "Close"]].dropna().to_dict(orient="records")

    # Chart 2: Moving Averages
    df["MA20"] = df["Close"].rolling(20).mean()
    df["MA50"] = df["Close"].rolling(50).mean()
    ma_chart = df[["Date", "Close", "MA20", "MA50"]].dropna().to_dict(orient="records")

    # Chart 3: 20-Day Rolling Volatility
    df["Daily_Return"] = df["Close"].pct_change()
    df["Rolling_Volatility"] = df["Daily_Return"].rolling(20).std()
    volatility = df[["Date", "Rolling_Volatility"]].dropna().to_dict(orient="records")

    
    return jsonify({
        "price_chart": price_chart,
        "ma_chart": ma_chart,
        "volatility": volatility,
        
    })



if __name__ == "__main__":
    app.run(debug=True)
