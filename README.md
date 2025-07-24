# SDAM_Kabo
# Dependencies
Install npm, nodejs, sqlite3


# Preparation

head -n -1 GenomeCRISPR_full.csv > GenomeCRISPR_trimmed.csv

´´´bash
sqlite3
.open genome_crispr.db
.mode csv
.import GenomeCRISPR_trimmed.csv genome_crispr

npm init -y
nodejs server.js
´´´
## note
start,end,chr,strand,pubmed,cellline,condition,sequence,symbol,ensg,log2fc,rc_initial,rc_final,effect,cas,screentype