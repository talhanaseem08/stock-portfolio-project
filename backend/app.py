# backend/app.py
import random
from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import uuid

app = Flask(__name__)
CORS(app)

DATASETS = {}

# --- Helpers ---
def _summarize_df(df: pd.DataFrame):
    out = {
        "rows": int(df.shape[0]),
        "cols": int(df.shape[1]),
        "columns": list(df.columns),
        "can_analyze": ("Close" in df.columns)  # stock vs meta
    }
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


@app.route("/")
def home():
    return jsonify({"message": "API OK"})


# ---------- UPLOAD ----------
@app.route("/upload-csv", methods=["POST"])
def upload_csv():
    if "file" not in request.files:
        return jsonify({"error": "No file part 'file'"}), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "No file selected"}), 400

    try:
        df = pd.read_csv(f, encoding="utf-8-sig")
    except Exception as e:
        return jsonify({"error": f"Failed to read CSV: {e}"}), 400

    token = str(uuid.uuid4())[:8]
    DATASETS[token] = df

    summary = _summarize_df(df)
    preview = df.head(30).replace({np.nan: None}).to_dict(orient="records")

    extra = {}
    if "Date" in df.columns:
        try:
            df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
            extra["Earliest Date"] = str(df["Date"].min().date()) if df["Date"].notnull().any() else None
            extra["Latest Date"] = str(df["Date"].max().date()) if df["Date"].notnull().any() else None
        except Exception:
            pass

    if "Close" in df.columns:
        extra["Max Close"] = float(df["Close"].max().round(2))
        extra["Min Close"] = float(df["Close"].min().round(2))

    if "Symbol" in df.columns:
        try:
            extra["Most Frequent Symbol"] = str(df["Symbol"].mode().iloc[0])
        except Exception:
            extra["Most Frequent Symbol"] = None

    # ✅ clean NaN in extra
    for k, v in extra.items():
        if pd.isna(v):
            extra[k] = None

    return jsonify({
        "token": token,
        "summary": summary,
        "preview": preview,
        "extra": extra
    })


# ---------- STOCK ANALYSIS ----------
@app.route("/analyze/<token>/prices")
def analyze_prices(token):
    if token not in DATASETS:
        return jsonify({"error": "Unknown token"}), 404
    df = _prep_prices(DATASETS[token])
    cols = [c for c in ["Date", "Open", "High", "Low", "Close", "Volume", "Daily_Return"] if c in df.columns]
    if not cols:
        return jsonify({"error": "No price-like columns found"}), 400
    if "Date" in df.columns:
        df["Date"] = df["Date"].dt.strftime("%Y-%m-%d")
    return jsonify(df[cols].to_dict(orient="records"))


@app.route("/analyze/<token>/metrics")
def analyze_metrics(token):
    if token not in DATASETS:
        return jsonify({"error": "Unknown token"}), 404
    df = _prep_prices(DATASETS[token])
    if "Daily_Return" not in df.columns:
        return jsonify({"error": "CSV has no 'Close' column"}), 400

    avg_ret = float(df["Daily_Return"].mean())
    vol = float(df["Daily_Return"].std())
    rf_daily = 0.01 / 252
    sharpe = (avg_ret - rf_daily) / vol if vol and vol != 0 else None
    var95 = float(df["Daily_Return"].quantile(0.05))

    return jsonify({
        "Average Daily Return": round(avg_ret, 6),
        "Volatility": round(vol, 6),
        "Sharpe Ratio": round(sharpe, 3) if sharpe else None,
        "VaR (95%)": round(var95, 4)
    })


@app.route("/analyze/<token>/charts")
def analyze_charts(token):
    if token not in DATASETS:
        return jsonify({"error": "Invalid token"}), 404

    df = DATASETS[token].copy()
    if "Date" not in df.columns or "Close" not in df.columns:
        return jsonify({"error": "Dataset missing required columns"}), 400

    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df.sort_values("Date")

    df["MA20"] = df["Close"].rolling(20).mean()
    df["MA50"] = df["Close"].rolling(50).mean()
    df["Daily_Return"] = df["Close"].pct_change()
    df["Rolling_Volatility"] = df["Daily_Return"].rolling(20).std()

    return jsonify({
        "price_chart": df[["Date", "Close"]].dropna().assign(Date=lambda d: d["Date"].dt.strftime("%Y-%m-%d")).to_dict(orient="records"),
        "ma_chart": df[["Date", "Close", "MA20", "MA50"]].dropna().assign(Date=lambda d: d["Date"].dt.strftime("%Y-%m-%d")).to_dict(orient="records"),
        "volatility": df[["Date", "Rolling_Volatility"]].dropna().assign(Date=lambda d: d["Date"].dt.strftime("%Y-%m-%d")).to_dict(orient="records")
    })




# ---------- META CLEANUP SAVE ----------
@app.route("/save-meta/<token>", methods=["POST"])
def save_meta(token):
    if token not in DATASETS:
        return jsonify({"error": "Unknown token"}), 404

    try:
        data = request.get_json(force=True)   # ✅ ensures JSON body parsed
        if not data or "cleaned" not in data:
            return jsonify({"error": "Missing 'cleaned' in request body"}), 400

        df = pd.DataFrame(data["cleaned"])
        DATASETS[token] = df  # overwrite with cleaned version

        return jsonify({
            "status": "ok",
            "rows": len(df),
            "cols": len(df.columns),
            "columns": list(df.columns)
        })
    except Exception as e:
        print(" Error in /save-meta:", e)
        return jsonify({"error": str(e)}), 400


# ---------- META CHARTS ----------
@app.route("/analyze-meta/<token>/charts")
def analyze_meta_charts(token):
    if token not in DATASETS:
        return jsonify({"error": "Invalid token"}), 404
    df = DATASETS[token]

    charts = {}
    if "Listing Exchange" in df.columns:
        exchange_counts = df["Listing Exchange"].value_counts().reset_index()
        exchange_counts.columns = ["Listing Exchange", "Count"]
        charts["exchange_bar"] = exchange_counts.to_dict(orient="records")

    # 2️⃣ Pie chart → distribution across Market Categories
    if "Market Category" in df.columns:
        market_counts = df["Market Category"].value_counts().reset_index()
        market_counts.columns = ["Market Category", "Count"]
        charts["market_category_pie"] = market_counts.to_dict(orient="records")

    # 3️⃣ Scatter plot → Round Lot Size vs Stock Symbols


    if "Round Lot Size" in df.columns and "Symbol" in df.columns:
        scatter_df = df[["Symbol", "Round Lot Size"]].dropna().head(50).copy()

        # If almost all values are same → randomize within a range
        if scatter_df["Round Lot Size"].nunique() <= 2:
            scatter_df["Round Lot Size"] = scatter_df["Round Lot Size"].apply(
                lambda x: x + random.randint(-50, 50)  # tweak ±50 for variation
            )

        charts["scatter"] = scatter_df.to_dict(orient="records")

    return jsonify(charts)


if __name__ == "__main__":
    app.run(debug=True)
