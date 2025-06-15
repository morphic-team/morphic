#!/bin/bash
"""
Download Runbook - Test image download performance using exported data

This script runs comprehensive download tests on exported search results
and saves the raw test data to the data/ directory for analysis.

Usage:
  ./runbooks/download.sh <search_results_export.csv> [options]

Options:
  -s, --strategy STRATEGY    Download strategy: baseline, best_python (default: baseline)
  -n, --sample SIZE          Sample size for testing (default: 10000)
  --random                   Use random sampling instead of first N records
  -w, --workers NUM          Number of concurrent workers (default: 10)
  -t, --timeout SECONDS      Request timeout in seconds (default: 10)

Examples:
  ./runbooks/download.sh data/search_results_export_20250614_002116.csv
  ./runbooks/download.sh data/export.csv -s best_python -n 5000 --random

Prerequisites:
  - Exported search results CSV file
  - Python packages: requests, PIL, dns, etc.

Outputs:
  - data/download_test_STRATEGY_sampleSIZE_YYYYMMDD_HHMMSS.csv
  - data/download_test_STRATEGY_sampleSIZE_YYYYMMDD_HHMMSS_reprocessed_YYYYMMDD_HHMMSS.csv (with valid_url column)
"""

set -e  # Exit on any error

# Configuration
DATA_DIR="data"
RESULTS_DIR="results"
SCRIPTS_DIR="scripts"

# Default options
STRATEGY="baseline"
SAMPLE_SIZE=10000
RANDOM_SAMPLING=""
WORKERS=10
TIMEOUT=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
INPUT_FILE=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--strategy)
            STRATEGY="$2"
            shift 2
            ;;
        -n|--sample)
            SAMPLE_SIZE="$2"
            shift 2
            ;;
        --random)
            RANDOM_SAMPLING="--random"
            shift
            ;;
        -w|--workers)
            WORKERS="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 <input_csv> [options]"
            echo "Run 'head -20 $0' for full documentation"
            exit 0
            ;;
        -*)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            exit 1
            ;;
        *)
            if [ -z "$INPUT_FILE" ]; then
                INPUT_FILE="$1"
            else
                echo -e "${RED}❌ Multiple input files specified${NC}"
                exit 1
            fi
            shift
            ;;
    esac
done

# Validation
if [ -z "$INPUT_FILE" ]; then
    echo -e "${RED}❌ No input file specified${NC}"
    echo "Usage: $0 <search_results_export.csv>"
    exit 1
fi

if [ ! -f "$INPUT_FILE" ]; then
    echo -e "${RED}❌ Input file not found: $INPUT_FILE${NC}"
    exit 1
fi

if [[ "$STRATEGY" != "baseline" && "$STRATEGY" != "best_python" ]]; then
    echo -e "${RED}❌ Invalid strategy: $STRATEGY${NC}"
    echo "Valid strategies: baseline, best_python"
    exit 1
fi

# Setup
echo -e "${BLUE}=== MORPHIC DOWNLOAD TEST RUNBOOK ===${NC}"
echo "Starting download tests at $(date)"
echo

echo -e "${YELLOW}📋 Test Configuration:${NC}"
echo "  Input file: $INPUT_FILE"
echo "  Strategy: $STRATEGY"
echo "  Sample size: $(printf "%'d" $SAMPLE_SIZE)"
echo "  Workers: $WORKERS"
echo "  Timeout: ${TIMEOUT}s"
echo "  Random sampling: $([ -n "$RANDOM_SAMPLING" ] && echo "Yes" || echo "No")"
echo

# Create directories
echo -e "${YELLOW}📁 Setting up directories...${NC}"
mkdir -p "$DATA_DIR" "$RESULTS_DIR"
echo "✓ Created $DATA_DIR/ and $RESULTS_DIR/"

# Check for download test script
DOWNLOAD_SCRIPT="$SCRIPTS_DIR/download_test.py"
if [ ! -f "$DOWNLOAD_SCRIPT" ]; then
    echo -e "${RED}❌ Download test script not found at $DOWNLOAD_SCRIPT${NC}"
    exit 1
fi

# Generate output filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
SAMPLE_SUFFIX=""
if [ "$SAMPLE_SIZE" -ne 0 ]; then
    SAMPLE_SUFFIX="_sample$SAMPLE_SIZE"
fi
OUTPUT_FILE="$DATA_DIR/download_test_${STRATEGY}${SAMPLE_SUFFIX}_${TIMESTAMP}.csv"

# Run download test
echo -e "${YELLOW}🚀 Running download tests...${NC}"
echo "This may take a while depending on sample size and network conditions"
echo

python "$DOWNLOAD_SCRIPT" "$INPUT_FILE" \
    --strategy "$STRATEGY" \
    --sample "$SAMPLE_SIZE" \
    $RANDOM_SAMPLING \
    --workers "$WORKERS" \
    --timeout "$TIMEOUT" \
    --output "$OUTPUT_FILE"

# Verify test results
if [ ! -f "$OUTPUT_FILE" ]; then
    echo -e "${RED}❌ Download test failed - output file not created${NC}"
    exit 1
fi

# Get file info
FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
RECORD_COUNT=$(wc -l < "$OUTPUT_FILE")
RECORD_COUNT=$((RECORD_COUNT - 1))  # Subtract header row

echo -e "${GREEN}✅ Download test completed successfully!${NC}"
echo

# Reprocess to add valid_url column
echo -e "${YELLOW}🔄 Reprocessing results to mark invalid URLs...${NC}"
REPROCESS_SCRIPT="$SCRIPTS_DIR/reprocess_invalid_urls.py"
if [ ! -f "$REPROCESS_SCRIPT" ]; then
    echo -e "${RED}❌ Reprocess script not found at $REPROCESS_SCRIPT${NC}"
    exit 1
fi

python "$REPROCESS_SCRIPT" "$OUTPUT_FILE"

# Find the reprocessed file
REPROCESSED_FILE=$(ls "${OUTPUT_FILE%.*}_reprocessed_"*.csv 2>/dev/null | head -1)
if [ ! -f "$REPROCESSED_FILE" ]; then
    echo -e "${RED}❌ Reprocessing failed - reprocessed file not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Reprocessing completed!${NC}"
echo

echo "📋 Download Test Summary:"
echo "  Strategy: $STRATEGY"
echo "  Raw results: $OUTPUT_FILE"
echo "  Processed results: $REPROCESSED_FILE"
echo "  Size: $FILE_SIZE"
echo "  Records tested: $(printf "%'d" $RECORD_COUNT)"
echo "  Completed at: $(date)"
echo

echo -e "${BLUE}📝 Next Steps:${NC}"
echo "1. Run analysis on the processed results:"
echo "   ./runbooks/analyze.sh $REPROCESSED_FILE"
echo "2. Or run specific analysis scripts:"
echo "   python scripts/analyze_funnel_by_id.py $REPROCESSED_FILE"
echo "   python scripts/analyze_protocol_trends.py $REPROCESSED_FILE"
echo

echo -e "${GREEN}Download runbook completed at $(date)${NC}"