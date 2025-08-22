from flask import Flask, jsonify
import pandas as pd

app = Flask(__name__)

# Load datasets
meta = pd.read_csv("/home/bahl/Desktop/Talha/Stock Project/data/symbols_valid_meta.csv")
a = pd.read_csv("/home/bahl/Desktop/Talha/Stock Project/data/A.csv")

@app.route('/')
def Home():
    return {"message": "its running"}

@app.route('/stocks')
def unique_stocks():
    num_unique = meta["Symbol"].nunique()
    name_of_stock = meta["Symbol"]
    return jsonify(num_unique)

if __name__ == "__main__":
    app.run(debug=True)