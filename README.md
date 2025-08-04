# Scientific Data Management - GenomeCRISPR Data Warehouse

For this course project a data warehouse was implemented to store data from a genomeCRISPR dataset as provided for the SDAM module. It implements a relational database through a RESTful server in which the user can search, see gene and sgRNA details and visualize their effects on simple plotly graphs.
This project provides two separate sql files, one for simple testing with a small dataset and one for the actual dataset comprising of >500,000 entries. It can be switched between these two datasets, as the sql files replace existing databases.

## 🚀 Features

- **Web Interface**: Interactive search and visualization of CRISPR genomic data
- **RESTful API**: Comprehensive programmatic access to all data and functionality
- **Advanced Search**: Gene symbol and ENSG ID search with auto-completion
- **Adjustable Pagination and Sorting**
- **Plotting**: Interactive plots using plotly.js

## 📁 Project Structure

```
SDAM_Kabo/
├── README.md                    # Project documentation
├── server.js                    # Main Express application
├── package.json                 # Node.js dependencies
│
├── frontend/                    # Web interface templates and assets
│   ├── index.html              # Main search page
│   ├── gene-overview.html      # Gene detail view with charts
│   ├── details.html            # Individual sgRNA details
│   └── css/
│       └── style.css           # Custom styles
│
├── model/                       # Data models
│   ├── BaseModel.js            # Base model with common functionality
│   ├── Gene.js                 # Gene model
│   └── GeneView.js             # Template compatibility layer
│
├── utils/                       # Helper utilities
│   └── responseHelpers.js      # Response formatting and validation
│
└── sql/                         # Database scripts
    ├── convert_to_db.sql       # Database schema creation
    ├── load_example_data.sql   # Example data (11 records)
    └── load_real_data.sql      # Provided data (543K records)
```

## 🔧 Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm (Node Package Manager)
- SQLite3

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/sudo-Karim/SDAM_Kabo.git
   cd SDAM_Kabo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up the database**
   
   Example dataset (fast, 11 records):
   ```bash
   sqlite3 genome_crispr.db < sql/load_example_data.sql
   ```
   
   Real genomeCRISPR dataset provided for this course (full dataset, 543K records):
   ```bash
   sqlite3 genome_crispr.db < sql/load_real_data.sql
   ```

4. **Start the server**
   ```bash
   node server.js
   ```

5. **Access the application**
   - Web Interface: http://localhost:3000
   - API Base URL: http://localhost:3000/api

## 🌐 Web Interface Usage

### Search Functionality
- Navigate to http://localhost:3000
- Enter a gene symbol (e.g., `TP53`, `BRCA1`) or ENSG ID (e.g., `ENSG00000141510`)
- View results in an organized gene card format
- Click on gene names for detailed analysis with interactive charts

### Gene Overview Pages
- Detailed gene information with experimental data
- Interactive Plotly.js charts showing sgRNA effects
- Cell line comparison and statistical analysis

## 🔌 API Usage

### Base URL
```
http://localhost:3000/api
```


### Endpoints

#### 1. Get Records with Pagination
```bash
GET /api/records?query=BRCA1&page=1&limit=10
```

**Parameters:**
- `query`: Gene symbol or ENSG ID (required for results)
- `page`: Page number (default: 1)
- `limit`: Results per page (max: 1000, default: 25)
- `sortBy`: Sort field (`symbol`, `chr`, `total_sgrnas`, `avg_log2fc`)
- `sortOrder`: `ASC` or `DESC`

**Response:**
```json
{
  "data": [
    {
      "id": "gene123",
      "symbol": "BRCA1",
      "ensg": "ENSG00000012048",
      "chr": "17",
      "totalSgRNAs": 30,
      "averageEffect": -0.779,
      "cellLineCount": 3,
      "experiments": [...]
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalResults": 1,
    "limit": 10,
    "hasNext": false,
    "hasPrev": false
  },
  "filters": {
    "query": "BRCA1",
    "sortBy": "symbol",
    "sortOrder": "ASC"
  }
}
```

#### 2. Get Specific Record
```bash
GET /api/records/:id
```

**Response:**
```json
{
  "data": {
    "id": 12345,
    "symbol": "TP53",
    "sequence": "GCAGCATCCCAACCAGGTGGAGG",
    "chr": "17",
    "start": 7571720,
    "end": 7571743,
    "log2fc": -1.23,
    "cellline": "HEK293",
    "foldChange": 0.426
  }
}
```

#### 3. Get Database Statistics
```bash
GET /api/stats
```

**Response:**
```json
{
  "totalRecords": 543592,
  "chromosomes": [
    {"chr": "1", "count": 52017},
    {"chr": "2", "count": 32760}
  ],
  "effects": [
    {"effect": "0", "count": 54265},
    {"effect": "9", "count": 30598}
  ],
  "topCellLines": [
    {"cellline": "KBM7", "count": 191118},
    {"cellline": "Jiyoye", "count": 191118}
  ]
}
```

#### 4. Search Suggestions
```bash
GET /api/search/suggest?q=BRC&limit=10
```

**Response:**
```json
{
  "suggestions": [
    {"value": "BRCA1", "type": "gene_symbol"},
    {"value": "BRCA2", "type": "gene_symbol"},
    {"value": "ENSG00000012048", "type": "ensg_id"}
  ]
}
```

### Example API Integration

#### cURL
```bash
# Search for genes
curl "http://localhost:3000/api/records?query=BRCA1&page=1&limit=10"

# Get database statistics
curl "http://localhost:3000/api/stats"

# Get search suggestions  
curl "http://localhost:3000/api/search/suggest?q=BRC"
```