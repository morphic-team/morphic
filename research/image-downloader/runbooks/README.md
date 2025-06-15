# Morphic Image Download Analysis Runbooks

This directory contains four comprehensive runbooks for analyzing image download performance in the Morphic system.

## Quick Start

Run these in order for a complete analysis pipeline:

```bash
# 1. Export data from production database
./runbooks/export.sh

# 2. Run download tests on exported data (multiple strategies)
./runbooks/download.sh data/search_results_export_YYYYMMDD_HHMMSS.csv --strategy baseline
./runbooks/download.sh data/search_results_export_YYYYMMDD_HHMMSS.csv --strategy best_python

# 3. Analyze individual download test results
./runbooks/analyze.sh data/download_test_baseline_*.csv
./runbooks/analyze.sh data/download_test_best_python_*.csv

# 4. Compare strategies and calculate uplift/ROI
./runbooks/compare.sh data/baseline_results.csv data/best_python_results.csv
```

## Directory Structure

After running all runbooks:

```
├── data/                    # Raw data files (large CSVs)
│   ├── search_results_export_*.csv       # Database exports
│   ├── download_test_*_raw.csv           # Raw download test results  
│   └── download_test_*_reprocessed.csv   # Processed results with valid_url column
├── results/                 # Analysis outputs
│   └── analysis_YYYYMMDD_HHMMSS/         # Timestamped analysis results
│       ├── *.png                         # Charts and visualizations
│       ├── *.csv                         # Analysis data tables
│       ├── *.json                        # Summary statistics
│       └── analysis_summary.txt          # Overall summary report
└── runbooks/               # This directory
```

## Runbook Details

### 1. export.sh - Database Export

**Purpose**: Extract search results data from production Morphic database

**Usage**: `./runbooks/export.sh`

**Prerequisites**:
- Access to production database
- Backend environment configured
- Backend submodule initialized

**Outputs**:
- `data/search_results_export_YYYYMMDD_HHMMSS.csv` - Complete search results dataset

### 2. download.sh - Download Testing  

**Purpose**: Test image download performance using multiple strategies

**Usage**: `./runbooks/download.sh <input_csv> [options]`

**Options**:
- `-s, --strategy`: Download strategy (baseline, best_python) 
- `-n, --sample`: Sample size for testing (default: 10000)
- `--random`: Use random sampling
- `-w, --workers`: Number of concurrent workers (default: 10)
- `-t, --timeout`: Request timeout in seconds (default: 10)

**Outputs**:
- `data/download_test_STRATEGY_sampleSIZE_YYYYMMDD_HHMMSS.csv` - Raw test results
- `data/download_test_*_reprocessed_*.csv` - Processed with `valid_url` column

### 3. analyze.sh - Single-Run Analysis

**Purpose**: Run comprehensive analysis on a single download test result

**Usage**: `./runbooks/analyze.sh <download_results_csv> [options]`

**Options**:
- `-s, --sample`: Sample size for analysis
- `--random`: Use random sampling  
- `--include-invalid-urls`: Include x-raw-image URLs in analysis
- `-b, --buckets`: Number of ID buckets (default: 20)
- `--skip-*`: Skip specific analyses

**Analysis Types**:
1. **Funnel Analysis**: Success rates by validation stage and ID range
2. **Protocol Trends**: HTTP/HTTPS/x-raw-image distribution over time  
3. **Content Rot**: Link decay patterns and degradation analysis
4. **Timeout Optimization**: Request timeout recommendations
5. **URL Quality**: Domain distribution and URL anomaly detection

**Outputs**:
- `results/analysis_YYYYMMDD_HHMMSS/` - Timestamped directory with all results
- Charts (*.png), data tables (*.csv), and summary report

### 4. compare.sh - Multi-Strategy Comparison

**Purpose**: Compare download test results across multiple strategies for uplift/ROI analysis

**Usage**: `./runbooks/compare.sh <run1.csv> <run2.csv> [run3.csv...] [options]`

**Options**:
- `--run-names NAME1 NAME2...`: Names for each run (default: auto-generated)
- `--time-cost MULTIPLIER`: Time cost multiplier for expensive strategies (default: 5.0)
- `--include-invalid-urls`: Include invalid URLs in comparison
- `-o, --output DIR`: Output directory (default: data/)

**Analysis Types**:
1. **Uplift/Falloff Analysis**: URLs rescued vs regressed between strategies
2. **Rescuable URL Analysis**: Performance on URLs where strategies can theoretically help
3. **ROI Analysis**: Cost/benefit metrics with time multipliers
4. **Domain-Level Patterns**: Which domains benefit most from advanced strategies
5. **Error Type Rescue Rates**: Effectiveness against specific failure modes

**Outputs**:
- `data/comparison_summary.csv` - Comparison matrix
- `data/rescuable_analysis_*.png` - Rescuable URL performance charts
- `data/transition_analysis_*.png` - Success/failure transition visualizations
- `data/detailed_comparison_results.json` - Complete analysis data

## Data Flow

```
Production DB → export.sh → data/export.csv
                                ↓
              download.sh → data/baseline_results.csv
                       ↓ → data/best_python_results.csv
                                ↓
              analyze.sh → results/analysis_baseline_*/
                       ↓ → results/analysis_best_python_*/
                                ↓
              compare.sh → data/comparison_summary.csv
                       ↓ → data/rescuable_analysis_*.png
                       ↓ → data/transition_analysis_*.png
```

## Key Features

### Consistent Invalid URL Handling
- All scripts expect and use the `valid_url` column
- x-raw-image URLs are marked as invalid and excluded by default
- `--include-invalid-urls` flag available when needed

### Fail-Fast Design  
- Scripts validate inputs and fail with clear error messages
- No silent fallbacks or data inconsistencies
- Required columns must exist (no patches)

### Comprehensive Analysis
- Multiple complementary analysis perspectives
- Timestamped outputs prevent overwrites
- Summary reports for easy review
- Both visual charts and raw data tables

## Troubleshooting

### Export Issues
- Ensure backend submodule is initialized: `git submodule update --init`
- Check database connectivity and credentials
- Verify export script exists in backend/scripts/

### Download Test Issues  
- Check network connectivity
- Reduce sample size or workers if getting timeouts
- Ensure sufficient disk space for large result files

### Analysis Issues
- Verify input file has `valid_url` column (run reprocess_invalid_urls.py if missing)
- Check that all required Python packages are installed
- Ensure sufficient memory for large datasets

### Missing valid_url Column
If you have old download test results without the `valid_url` column:

```bash
python scripts/reprocess_invalid_urls.py data/old_download_results.csv
```

This will create a new file with the required column added.