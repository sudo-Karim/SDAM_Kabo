# Genomic CRISPR Data Warehouse - RESTful API Documentation

## Base URL
```
http://localhost:3000/api
```

## Authentication
Currently, no authentication is required for API access.

## Response Format
All API responses follow a consistent JSON format:

**Success Response:**
```json
{
  "data": [...],
  "pagination": {...},
  "filters": {...}
}
```

**Error Response:**
```json
{
  "error": "Error message description"
}
```

## Endpoints

### 1. Get All Records
**GET** `/api/records`

Retrieve genomic CRISPR records with pagination and filtering.

**Parameters:**
- `query` (string, optional): Search query for genes, symbols, chromosomes
- `strand` (string, optional): Filter by strand (`+`, `-`, or empty)
- `effect` (string, optional): Filter by effect (e.g., `activating`, `inhibiting`)
- `page` (integer, optional): Page number (default: 1)
- `limit` (integer, optional): Records per page (default: 25, max: 1000)
- `sortBy` (string, optional): Sort field (default: `rowid`)
  - Allowed values: `rowid`, `chr`, `start`, `end`, `strand`, `symbol`, `ensg`, `log2fc`, `effect`, `cellline`
- `sortOrder` (string, optional): Sort direction (`ASC` or `DESC`, default: `ASC`)

**Example Request:**
```bash
GET /api/records?query=BRCA1&strand=+&page=1&limit=10&sortBy=symbol&sortOrder=ASC
```

**Example Response:**
```json
{
  "data": [
    {
      "id": 12345,
      "start": 43044295,
      "end": 43170245,
      "chr": "chr17",
      "strand": "+",
      "symbol": "BRCA1",
      "ensg": "ENSG00000012048",
      "log2fc": -2.5,
      "effect": "inhibiting",
      "cellline": "HEK293T",
      "condition": "normal",
      "sequence": "GTTCCGTGGCAACGGAAAAGCGCGGGAATTACAGATAAATTAAAACTGCGACTGCGCGGCGTGAGCTCGCTGATCACTAATTCGTTTGTGAGGAGGAAATTAATAGGTTGTATTGATGTTGGACGAGTCGGAATCGCAGACCGATACCAGGATCTTGCCATCCTATGGAACTGCCTCGGTGAGTTTTCTCCTTCATTACAGAAACGGCTTTTTCAAAAATATGGTATTGATAATCCTGATATGAATAAATTGCAGTTTCATTTGATGCTCGATGAGTTTTTCTAATCAGAATTGGTTAATTGGTTGTAACACTGGCAGAGCTCTAATTTTTGGGAAGCTGTCACGTTTGTGTTTCAGATGGCGAAGGCACTAAATGAGATTTAATATGAGAAGTTTGAATCCAGGAAGTGAAGAGATGAGTTATAGATAAGGCAATG",
      "pubmed": "12345678",
      "cas": "SpCas9",
      "screentype": "survival",
      "rc_initial": 1000,
      "rc_final": 250,
      "midpoint": 43107270,
      "length": 125951,
      "foldChange": 0.177
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 50,
    "totalResults": 500,
    "limit": 10,
    "hasNext": true,
    "hasPrev": false
  },
  "filters": {
    "query": "BRCA1",
    "strand": "+",
    "effect": "",
    "sortBy": "symbol",
    "sortOrder": "ASC"
  }
}
```

### 2. Get Single Record
**GET** `/api/records/:id`

Retrieve a specific genomic CRISPR record by ID.

**Parameters:**
- `id` (integer, required): Record ID

**Example Request:**
```bash
GET /api/records/12345
```

**Example Response:**
```json
{
  "data": {
    "id": 12345,
    "start": 43044295,
    "end": 43170245,
    "chr": "chr17",
    "strand": "+",
    "symbol": "BRCA1",
    "ensg": "ENSG00000012048",
    "log2fc": -2.5,
    "effect": "inhibiting",
    "cellline": "HEK293T",
    "condition": "normal",
    "sequence": "GTTCCGTGGCAACGGAAAAGCGCGGGAATTACAGATAAATT...",
    "pubmed": "12345678",
    "cas": "SpCas9",
    "screentype": "survival",
    "rc_initial": 1000,
    "rc_final": 250,
    "midpoint": 43107270,
    "length": 125951,
    "foldChange": 0.177
  }
}
```

### 3. Get Database Statistics
**GET** `/api/stats`

Retrieve database statistics and summary information.

**Example Request:**
```bash
GET /api/stats
```

**Example Response:**
```json
{
  "totalRecords": 543592,
  "chromosomes": [
    {"chr": "chr1", "count": 35420},
    {"chr": "chr2", "count": 28934},
    ...
  ],
  "strands": [
    {"strand": "+", "count": 271796},
    {"strand": "-", "count": 271796}
  ],
  "effects": [
    {"effect": "inhibiting", "count": 300000},
    {"effect": "activating", "count": 200000},
    {"effect": "neutral", "count": 43592}
  ],
  "topCellLines": [
    {"cellline": "HEK293T", "count": 150000},
    {"cellline": "HeLa", "count": 120000},
    ...
  ]
}
```

### 4. Search Suggestions
**GET** `/api/search/suggest`

Get search suggestions for auto-completion.

**Parameters:**
- `q` (string, required): Query string (minimum 2 characters)
- `limit` (integer, optional): Maximum suggestions (default: 10, max: 50)

**Example Request:**
```bash
GET /api/search/suggest?q=BRC&limit=5
```

**Example Response:**
```json
{
  "suggestions": [
    {"value": "BRCA1", "type": "gene_symbol"},
    {"value": "BRCA2", "type": "gene_symbol"},
    {"value": "BRCC3", "type": "gene_symbol"},
    {"value": "ENSG00000012048", "type": "ensg_id"},
    {"value": "chr17", "type": "chromosome"}
  ]
}
```

### 5. Export Data
**GET** `/api/export`

Export search results in CSV or JSON format.

**Parameters:**
- `query` (string, optional): Search query
- `strand` (string, optional): Filter by strand
- `effect` (string, optional): Filter by effect
- `format` (string, optional): Export format (`csv` or `json`, default: `csv`)
- `limit` (integer, optional): Maximum records (default: 10000, max: 50000)

**Example Request:**
```bash
GET /api/export?query=BRCA1&format=csv&limit=1000
```

**CSV Response:**
```csv
ID,Chromosome,Start,End,Strand,Symbol,ENSG,Log2FC,Effect,Cell_Line,Condition,Sequence,PubMed,CAS,Screen_Type,RC_Initial,RC_Final
12345,chr17,43044295,43170245,+,"BRCA1",ENSG00000012048,-2.5,"inhibiting","HEK293T","normal","GTTCCGTGGCAACGG...",12345678,SpCas9,"survival",1000,250
```

**JSON Response:**
```json
{
  "data": [...],
  "metadata": {
    "exportDate": "2025-07-27T10:30:00.000Z",
    "totalRecords": 1000,
    "filters": {
      "query": "BRCA1",
      "strand": "",
      "effect": ""
    }
  }
}
```

## Error Codes

- **400 Bad Request**: Invalid parameters or malformed request
- **404 Not Found**: Record not found
- **500 Internal Server Error**: Server error

## Rate Limiting

Currently, no rate limiting is implemented. For production use, consider implementing rate limiting to prevent abuse.

## Data Types

### Record Object
```typescript
{
  id: number,
  start: number,
  end: number,
  chr: string,
  strand: string,
  symbol: string,
  ensg: string,
  log2fc: number,
  effect: string,
  cellline: string,
  condition: string,
  sequence: string,
  pubmed: string,
  cas: string,
  screentype: string,
  rc_initial: number,
  rc_final: number,
  midpoint: number,        // Calculated: (start + end) / 2
  length: number,          // Calculated: end - start + 1
  foldChange: number       // Calculated: 2^log2fc
}
```

## Usage Examples

### Python Example
```python
import requests

# Get records
response = requests.get('http://localhost:3000/api/records', {
    'query': 'BRCA1',
    'page': 1,
    'limit': 10
})
data = response.json()

# Get single record
record = requests.get('http://localhost:3000/api/records/12345').json()

# Export data
export_url = 'http://localhost:3000/api/export?query=BRCA1&format=csv'
with open('export.csv', 'w') as f:
    f.write(requests.get(export_url).text)
```

### JavaScript Example
```javascript
// Using fetch API
async function getRecords(query, page = 1) {
    const response = await fetch(`/api/records?query=${query}&page=${page}`);
    return await response.json();
}

// Get suggestions
async function getSuggestions(query) {
    const response = await fetch(`/api/search/suggest?q=${query}`);
    return await response.json();
}

// Export data
function exportData(query, format = 'csv') {
    window.open(`/api/export?query=${query}&format=${format}`);
}
```

### curl Examples
```bash
# Get records
curl "http://localhost:3000/api/records?query=BRCA1&page=1&limit=10"

# Get single record
curl "http://localhost:3000/api/records/12345"

# Get statistics
curl "http://localhost:3000/api/stats"

# Get suggestions
curl "http://localhost:3000/api/search/suggest?q=BRC"

# Export as CSV
curl "http://localhost:3000/api/export?query=BRCA1&format=csv" -o export.csv

# Export as JSON
curl "http://localhost:3000/api/export?query=BRCA1&format=json" > export.json
```
