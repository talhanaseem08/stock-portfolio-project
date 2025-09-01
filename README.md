# 📊 Stock Portfolio Analysis Dashboard

A modern, responsive web application for analyzing stock data and market metadata with beautiful visualizations and comprehensive analytics.

![Dashboard Preview](https://img.shields.io/badge/Dashboard-Modern%20Dark%20Theme-blue)
![Python](https://img.shields.io/badge/Python-3.10+-green)
![Flask](https://img.shields.io/badge/Flask-2.0+-red)
![Chart.js](https://img.shields.io/badge/Chart.js-4.0+-orange)

## 🚀 Features

### 📈 Stock Data Analysis
- **Price Visualization**: Interactive line charts showing stock price trends over time
- **Moving Averages**: 20-day and 50-day moving average analysis
- **Volatility Analysis**: 20-day rolling volatility calculations
- **Financial Metrics**: Sharpe ratio, VaR (95%), average daily returns, and volatility

### 📊 Meta Data Analysis
- **Exchange Distribution**: Bar charts showing stock distribution across exchanges
- **Market Categories**: Pie charts displaying market category breakdowns
- **Scatter Analysis**: Relationship analysis between stock symbols and round lot sizes
- **Advanced Analytics**: ETF vs Non-ETF analysis, market cap statistics, sector distribution

### 🎨 Modern UI/UX
- **Dark Theme**: Professional dark theme with gradient accents
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Interactive Charts**: Hover effects, smooth animations, and detailed tooltips
- **Data Tables**: Enhanced DataTables with search, pagination, and sorting

## 🛠️ Technology Stack

### Backend
- **Python 3.10+**: Core programming language
- **Flask**: Lightweight web framework
- **Pandas**: Data manipulation and analysis
- **NumPy**: Numerical computing
- **Flask-CORS**: Cross-origin resource sharing

### Frontend
- **HTML5**: Semantic markup
- **CSS3**: Modern styling with gradients and animations
- **JavaScript (ES6+)**: Interactive functionality
- **Bootstrap 5**: Responsive UI framework
- **Chart.js**: Interactive chart library
- **DataTables**: Enhanced table functionality
- **jQuery**: DOM manipulation and AJAX

## 📁 Project Structure

```
stock-portfolio-project/
├── backend/
│   └── app.py                 # Flask backend server
├── frontend/
│   ├── index.html            # Main HTML file
│   ├── style.css             # Custom CSS styling
│   └── script.js             # JavaScript functionality
├── data/
│   ├── A.csv                 # Sample stock data
│   └── symbols_valid_meta.csv # Sample metadata
├── notebooks/
│   └── analysis.ipynb        # Jupyter analysis notebook
├── requirements.txt          # Python dependencies
└── README.md                # Project documentation
```

## 🚀 Quick Start

### Prerequisites
- Python 3.10 or higher
- pip (Python package installer)
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd stock-portfolio-project
   ```

2. **Create a virtual environment** (recommended)
   ```bash
   python3 -m venv myenv
   source myenv/bin/activate  # On Windows: myenv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the backend server**
   ```bash
   python3 backend/app.py
   ```
   The server will start on `http://127.0.0.1:5000`

5. **Open the frontend**
   - Open `frontend/index.html` in your web browser
   - Or serve it using a local server (recommended)

## 📊 Usage Guide

### Stock Data Analysis

1. **Upload Stock CSV**
   - Click "Choose File" and select a CSV file with stock data
   - Required columns: `Date`, `Close` (minimum)
   - Optional columns: `Open`, `High`, `Low`, `Volume`

2. **View Analysis**
   - **Overview Tab**: File summary, preview, and key metrics
   - **Analysis Tab**: Price charts, moving averages, and volatility analysis

### Meta Data Analysis

1. **Upload Meta CSV**
   - Upload a CSV file with stock metadata
   - Common columns: `Symbol`, `Listing Exchange`, `Market Category`, `ETF`, etc.

2. **Data Cleanup**
   - Review and remove unnecessary columns
   - Click "Save & Continue" to proceed

3. **View Meta Analysis**
   - **Overview Tab**: Summary statistics and data preview
   - **Meta Analysis Tab**: Exchange distribution, market categories, and advanced analytics

## 📈 Supported Data Formats

### Stock Data CSV Format
```csv
Date,Open,High,Low,Close,Volume
2023-01-01,100.00,105.00,98.00,102.50,1000000
2023-01-02,102.50,108.00,101.00,106.75,1200000
```

### Meta Data CSV Format
```csv
Symbol,Listing Exchange,Market Category,ETF,Sector,Market Cap
AAPL,NASDAQ,Common Stock,N,Technology,3000000000000
MSFT,NASDAQ,Common Stock,N,Technology,2800000000000
```

## 🎨 Customization

### Styling
- Modify `frontend/style.css` to customize colors, fonts, and layout
- The theme uses CSS custom properties for easy color scheme changes

### Chart Configuration
- Edit chart options in `frontend/script.js`
- Customize colors, animations, and chart types

### Backend Analytics
- Extend analysis functions in `backend/app.py`
- Add new metrics and calculations as needed

## 🔧 API Endpoints

### File Upload
- `POST /upload-csv` - Upload and analyze CSV files

### Stock Analysis
- `GET /analyze/<token>/metrics` - Get financial metrics
- `GET /analyze/<token>/charts` - Get chart data
- `GET /analyze/<token>/prices` - Get price data

### Meta Analysis
- `GET /analyze-meta/<token>/charts` - Get meta charts
- `GET /analyze-meta/<token>/kpis` - Get key performance indicators
- `GET /analyze-meta/<token>/advanced` - Get advanced analytics
- `POST /save-meta/<token>` - Save cleaned meta data

## 🎯 Key Features Explained

### Financial Metrics
- **Sharpe Ratio**: Risk-adjusted return measure
- **VaR (95%)**: Value at Risk at 95% confidence level
- **Volatility**: Standard deviation of daily returns
- **Moving Averages**: Trend analysis using 20-day and 50-day periods

### Visualizations
- **Line Charts**: Price trends with smooth animations
- **Bar Charts**: Categorical data with gradient colors
- **Pie Charts**: Proportional data with enhanced tooltips
- **Scatter Plots**: Relationship analysis with hover effects

### Data Processing
- **Automatic Date Parsing**: Handles various date formats
- **Missing Data Handling**: Graceful handling of incomplete data
- **Data Validation**: Ensures data quality and consistency

## 🚨 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Kill existing process
   lsof -ti:5000 | xargs kill -9
   # Or use a different port
   python3 backend/app.py --port 5001
   ```

2. **CORS Errors**
   - Ensure Flask-CORS is installed
   - Check that the frontend is being served properly

3. **Chart Not Displaying**
   - Check browser console for JavaScript errors
   - Verify Chart.js is loaded correctly
   - Ensure data is in the correct format

4. **File Upload Issues**
   - Check file format (must be CSV)
   - Verify required columns are present
   - Ensure file size is reasonable

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Chart.js** for the excellent charting library
- **Bootstrap** for the responsive UI framework
- **Flask** for the lightweight web framework
- **Pandas** for powerful data analysis capabilities

## 📞 Support

For support, email talhan094@gmail.com or create an issue in the repository.

---

**Made with ❤️ for financial data analysis**
