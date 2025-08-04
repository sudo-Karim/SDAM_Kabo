-- Load real data
-- This creates normalized structure and loads complete CRISPR dataset
-- Usage: sqlite3 genome_crispr.db < sql/load_real_data.sql

-- First create the trimmed CSV file (remove header and incomplete last line)
.shell tail -n +2 GenomeCRISPR_full.csv | head -n -1 > GenomeCRISPR_trimmed.csv

-- Drop existing tables if they exist
DROP VIEW IF EXISTS genome_crispr;
DROP VIEW IF EXISTS genome_crispr_relational;
DROP VIEW IF EXISTS genome_crispr_view;
DROP TABLE IF EXISTS genome_crispr;
DROP TABLE IF EXISTS genes;
DROP TABLE IF EXISTS cell_lines;
DROP TABLE IF EXISTS experiments;
DROP TABLE IF EXISTS sgrnas;

-- Create normalized table structure
CREATE TABLE genes (
    gene_id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL UNIQUE,
    ensg TEXT,
    chr TEXT NOT NULL
);

CREATE TABLE cell_lines (
    cellline_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE experiments (
    experiment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    gene_id INTEGER NOT NULL,
    cellline_id INTEGER NOT NULL,
    condition TEXT,
    cas TEXT,
    screentype TEXT,
    pubmed TEXT,
    FOREIGN KEY (gene_id) REFERENCES genes(gene_id),
    FOREIGN KEY (cellline_id) REFERENCES cell_lines(cellline_id)
);

CREATE TABLE sgrnas (
    sgrna_id INTEGER PRIMARY KEY AUTOINCREMENT,
    experiment_id INTEGER NOT NULL,
    sequence TEXT NOT NULL,
    start_pos INTEGER NOT NULL,
    end_pos INTEGER NOT NULL,
    strand TEXT,
    log2fc REAL,
    effect TEXT,
    rc_initial INTEGER,
    rc_final INTEGER,
    FOREIGN KEY (experiment_id) REFERENCES experiments(experiment_id)
);

-- Create temporary flat table for import
CREATE TABLE genome_crispr(
"start" TEXT, "end" TEXT, "chr" TEXT, "strand" TEXT,
 "pubmed" TEXT, "cellline" TEXT, "condition" TEXT, "sequence" TEXT,
 "symbol" TEXT, "ensg" TEXT, "log2fc" TEXT, "rc_initial" TEXT,
 "rc_final" TEXT, "effect" TEXT, "cas" TEXT, "screentype" TEXT);

-- Import CSV data into flat table
.mode csv
.import GenomeCRISPR_trimmed.csv genome_crispr

-- Populate normalized tables from flat data
INSERT OR IGNORE INTO genes (symbol, ensg, chr)
SELECT DISTINCT symbol, ensg, chr 
FROM genome_crispr 
WHERE symbol IS NOT NULL AND symbol != '';

INSERT OR IGNORE INTO cell_lines (name)
SELECT DISTINCT cellline 
FROM genome_crispr 
WHERE cellline IS NOT NULL AND cellline != '';

INSERT OR IGNORE INTO experiments (gene_id, cellline_id, condition, cas, screentype, pubmed)
SELECT DISTINCT 
    g.gene_id,
    cl.cellline_id,
    COALESCE(gc.condition, ''),
    COALESCE(gc.cas, ''),
    COALESCE(gc.screentype, ''),
    COALESCE(gc.pubmed, '')
FROM genome_crispr gc
JOIN genes g ON gc.symbol = g.symbol
JOIN cell_lines cl ON gc.cellline = cl.name
WHERE gc.symbol IS NOT NULL AND gc.cellline IS NOT NULL;

INSERT INTO sgrnas (experiment_id, sequence, start_pos, end_pos, strand, log2fc, effect, rc_initial, rc_final)
SELECT 
    e.experiment_id,
    gc.sequence,
    CAST(gc.start AS INTEGER),
    CAST(gc.end AS INTEGER),
    gc.strand,
    CASE WHEN gc.log2fc = '' OR gc.log2fc IS NULL THEN NULL ELSE CAST(gc.log2fc AS REAL) END,
    gc.effect,
    CASE 
        WHEN gc.rc_initial = '' OR gc.rc_initial IS NULL THEN NULL 
        WHEN gc.rc_initial LIKE '[%]' THEN CAST(SUBSTR(gc.rc_initial, 2, LENGTH(gc.rc_initial)-2) AS INTEGER)
        ELSE CAST(gc.rc_initial AS INTEGER) 
    END,
    CASE 
        WHEN gc.rc_final = '' OR gc.rc_final IS NULL THEN NULL 
        WHEN gc.rc_final LIKE '[%]' THEN CAST(SUBSTR(gc.rc_final, 2, LENGTH(gc.rc_final)-2) AS INTEGER)
        ELSE CAST(gc.rc_final AS INTEGER) 
    END
FROM genome_crispr gc
JOIN genes g ON gc.symbol = g.symbol
JOIN cell_lines cl ON gc.cellline = cl.name  
JOIN experiments e ON e.gene_id = g.gene_id 
    AND e.cellline_id = cl.cellline_id
    AND COALESCE(e.condition, '') = COALESCE(gc.condition, '')
    AND COALESCE(e.cas, '') = COALESCE(gc.cas, '')
    AND COALESCE(e.screentype, '') = COALESCE(gc.screentype, '')
    AND COALESCE(e.pubmed, '') = COALESCE(gc.pubmed, '')
WHERE gc.symbol IS NOT NULL AND gc.cellline IS NOT NULL;

-- Create optimized indexes for relational queries
CREATE INDEX idx_genes_symbol ON genes(symbol);
CREATE INDEX idx_genes_chr ON genes(chr);
CREATE INDEX idx_experiments_gene ON experiments(gene_id);
CREATE INDEX idx_experiments_cellline ON experiments(cellline_id);
CREATE INDEX idx_sgrnas_experiment ON sgrnas(experiment_id);
CREATE INDEX idx_sgrnas_log2fc ON sgrnas(log2fc);
CREATE INDEX idx_sgrnas_position ON sgrnas(start_pos, end_pos);
CREATE INDEX idx_genes_symbol_chr ON genes(symbol, chr);
CREATE INDEX idx_experiments_gene_cellline ON experiments(gene_id, cellline_id);

-- Create compatibility view
CREATE VIEW genome_crispr_relational AS
SELECT 
    s.sgrna_id as rowid,
    s.start_pos as start,
    s.end_pos as end,
    g.chr,
    s.strand,
    e.pubmed,
    cl.name as cellline,
    e.condition,
    s.sequence,
    g.symbol,
    g.ensg,
    s.log2fc,
    s.rc_initial,
    s.rc_final,
    s.effect,
    e.cas,
    e.screentype
FROM sgrnas s
JOIN experiments e ON s.experiment_id = e.experiment_id
JOIN genes g ON e.gene_id = g.gene_id
JOIN cell_lines cl ON e.cellline_id = cl.cellline_id;

-- Drop the temporary flat table and replace with view
DROP TABLE genome_crispr;
CREATE VIEW genome_crispr AS SELECT * FROM genome_crispr_relational;

-- Verify real data loaded successfully
SELECT 'Real data loaded:' as info, COUNT(*) as records FROM genome_crispr;
SELECT 'Database switched to REAL data - Ready for production' as status;
