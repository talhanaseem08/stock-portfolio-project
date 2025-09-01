import random
from flask import Flask, jsonify, request
from flask_cors import CORS
import pandas as pd
import numpy as np
import uuid

app = Flask(__name__)
CORS(app)

DATASETS = {}

def _summarize_df(df: pd.DataFrame):
    out = {
        "rows": int(df.shape[0]),
        "cols": int(df.shape[1]),
        "columns": list(df.columns),
        "can_analyze": ("Close" in df.columns)  
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


    for k, v in extra.items():
        if pd.isna(v):
            extra[k] = None

    return jsonify({
        "token": token,
        "summary": summary,
        "preview": preview,
        "extra": extra
    })



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
        "price_chart": df[["Date", "Close"]].dropna().assign(Date=lambda d: d["Date"].dt.strftime("%Y")).to_dict(orient="records"),
        "ma_chart": df[["Date", "Close", "MA20", "MA50"]].dropna().assign(Date=lambda d: d["Date"].dt.strftime("%Y")).to_dict(orient="records"),
        "volatility": df[["Date", "Rolling_Volatility"]].dropna().assign(Date=lambda d: d["Date"].dt.strftime("%Y")).to_dict(orient="records")
    })





@app.route("/save-meta/<token>", methods=["POST"])
def save_meta(token):
    if token not in DATASETS:
        return jsonify({"error": "Unknown token"}), 404

    try:
        data = request.get_json(force=True)   
        if not data or "cleaned" not in data:
            return jsonify({"error": "Missing 'cleaned' in request body"}), 400

        df = pd.DataFrame(data["cleaned"])
        DATASETS[token] = df  

        return jsonify({
            "status": "ok",
            "rows": len(df),
            "cols": len(df.columns),
            "columns": list(df.columns)
        })
    except Exception as e:
        print(" Error in /save-meta:", e)
        return jsonify({"error": str(e)}), 400



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

  
    if "Market Category" in df.columns:
 
        df_copy = df.copy()
        
       
        df_copy["Market Category"] = df_copy["Market Category"].replace({
            "": "Other",
            " ": "Other",
            pd.NA: "Other",
            None: "Other"
        }).fillna("Other")
   
        market_counts = df_copy["Market Category"].value_counts().reset_index()
        market_counts.columns = ["Market Category", "Count"]
        
        charts["market_category_pie"] = market_counts.to_dict(orient="records")
        
    else:
        print("Market Category column not found in dataset")
        print(f"Available columns: {list(df.columns)}")

    if "Round Lot Size" in df.columns and "Symbol" in df.columns:
        scatter_df = df[["Symbol", "Round Lot Size"]].dropna().head(100).copy()
        
        
        try:
            scatter_df["Round Lot Size"] = pd.to_numeric(scatter_df["Round Lot Size"], errors='coerce')
            scatter_df = scatter_df.dropna()
        except:
            pass
            
   
        if scatter_df["Round Lot Size"].nunique() <= 3:
            scatter_df["Round Lot Size"] = scatter_df["Round Lot Size"].apply(
                lambda x: x + random.randint(-50, 50)  
            )

        charts["scatter"] = scatter_df.to_dict(orient="records")

    return jsonify(charts)


@app.route("/analyze-meta/<token>/advanced")
def analyze_meta_advanced(token):
    if token not in DATASETS:
        return jsonify({"error": "Invalid token"}), 404
    
    df = DATASETS[token]
    analysis = {}
   
    if "ETF" in df.columns:
        etf_analysis = df["ETF"].value_counts().reset_index()
        etf_analysis.columns = ["ETF Status", "Count"]
        analysis["etf_breakdown"] = etf_analysis.to_dict(orient="records")
        
        
        total_stocks = len(df)
        etf_count = len(df[df["ETF"] == "Y"])
        non_etf_count = total_stocks - etf_count
        
        analysis["etf_percentages"] = {
            "ETF Percentage": round((etf_count / total_stocks) * 100, 2),
            "Non-ETF Percentage": round((non_etf_count / total_stocks) * 100, 2)
        }
    

    if "Listing Exchange" in df.columns and "Market Category" in df.columns:
        cross_tab = pd.crosstab(df["Listing Exchange"], df["Market Category"])
        analysis["exchange_market_cross"] = cross_tab.to_dict()
    
    # 5. Round Lot Size Distribution
    if "Round Lot Size" in df.columns:
        try:
            df_copy = df.copy()
            df_copy["Round Lot Size"] = pd.to_numeric(df_copy["Round Lot Size"], errors='coerce')
            df_copy = df_copy.dropna(subset=["Round Lot Size"])
            
            if not df_copy.empty:
         
                min_val = df_copy["Round Lot Size"].min()
                max_val = df_copy["Round Lot Size"].max()
                
                if max_val > min_val:
                 
                    range_size = (max_val - min_val) / 5
                    ranges = []
                    for i in range(5):
                        start = min_val + (i * range_size)
                        end = min_val + ((i + 1) * range_size)
                        ranges.append(f"{start:.0f}-{end:.0f}")
                    
                  
                    range_counts = []
                    for i, range_label in enumerate(ranges):
                        start = min_val + (i * range_size)
                        end = min_val + ((i + 1) * range_size)
                        count = len(df_copy[(df_copy["Round Lot Size"] >= start) & (df_copy["Round Lot Size"] < end)])
                        if count > 0:
                            range_counts.append({"Round Lot Size Range": range_label, "Count": count})
                    
                    analysis["round_lot_distribution"] = range_counts
                else:

                    analysis["round_lot_distribution"] = [{"Round Lot Size Range": f"All {min_val}", "Count": len(df_copy)}]
        except Exception as e:
            print(f"Error processing round lot size: {e}")
            pass
    
    # 6. Top 10 Companies by Round Lot Size (with randomization if values are nearly identical)
    if "Round Lot Size" in df.columns and "Symbol" in df.columns:
        try:
            top_df = df[["Symbol", "Round Lot Size"]].copy()
            top_df["Round Lot Size"] = pd.to_numeric(top_df["Round Lot Size"], errors='coerce')
            top_df = top_df.dropna(subset=["Round Lot Size"])\
                           .groupby("Symbol", as_index=False)["Round Lot Size"].max()

            if not top_df.empty:
                # Select top 10 by original values
                top_10 = top_df.sort_values("Round Lot Size", ascending=False).head(10).copy()

                # If top 10 are nearly identical → add jitter only to those for visualization
                top10_unique = top_10["Round Lot Size"].nunique()
                top10_range = float(top_10["Round Lot Size"].max() - top_10["Round Lot Size"].min()) if not top_10.empty else 0.0

                if top10_unique <= 3 or top10_range < 1e-6:
                    def _jitter(x):
                        try:
                            j = random.randint(-50, 50)
                            return max(0, float(x) + j)
                        except Exception:
                            return x
                    top_10["Round Lot Size"] = top_10["Round Lot Size"].apply(_jitter)
                    # Re-sort after jitter to keep descending order for the chart
                    top_10 = top_10.sort_values("Round Lot Size", ascending=False)

                analysis["top_round_lot"] = top_10.to_dict(orient="records")
                print("Top 10 round lot size:", top_10.to_dict(orient="records"))
        except Exception:
            pass
    
   
    if "Financial Status" in df.columns:
        financial_status = df["Financial Status"].value_counts().reset_index()
        financial_status.columns = ["Financial Status", "Count"]
        analysis["financial_status"] = financial_status.to_dict(orient="records")
    
  
    
    
    
    return jsonify(analysis)



@app.route("/analyze-meta/<token>/kpis")
def analyze_meta_kpis(token):
    if token not in DATASETS:
        return jsonify({"error": "Invalid token"}), 404
    
    df = DATASETS[token]
    kpis = {}
 
    if "Symbol" in df.columns:
        num_unique = df["Symbol"].nunique()
        kpis["Unique Stocks"] = int(num_unique)
    else:
        kpis["Unique Stocks"] = "N/A"

    if "Listing Exchange" in df.columns:
        exchange_list = df['Listing Exchange'].value_counts()
        kpis["Exchange Distribution"] = exchange_list.to_dict()
    else:
        kpis["Exchange Distribution"] = "N/A"
    
    
    if "ETF" in df.columns:
        etf_count = df[df['ETF'] == 'Y'].shape[0]
        kpis["ETF Count"] = int(etf_count)
    else:
        kpis["ETF Count"] = "N/A"
    

    if "ETF" in df.columns:
        total_stocks = len(df)
        etf_count = len(df[df["ETF"] == "Y"])
        non_etf_count = total_stocks - etf_count
        
        kpis["ETF vs Non-ETF"] = {
            "ETF Count": int(etf_count),
            "Non-ETF Count": int(non_etf_count),
            "ETF Percentage": round((etf_count / total_stocks) * 100, 2),
            "Non-ETF Percentage": round((non_etf_count / total_stocks) * 100, 2)
        }
    else:
        kpis["ETF vs Non-ETF"] = "N/A"
    
    return jsonify(kpis)


if __name__ == "__main__":
    app.run(debug=True)
