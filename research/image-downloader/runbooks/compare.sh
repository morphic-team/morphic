#!/bin/bash
#
# Comparison Runbook - Compare multiple download test runs for strategy analysis
#
# This script compares download test results from different strategies to analyze
# uplift/falloff patterns, calculate ROI metrics, and generate comparison visualizations.
#
# Usage:
#   ./runbooks/compare.sh <run1.csv> <run2.csv> [run3.csv...] [options]
#
# Options:
#   --run-names NAME1 NAME2...     Names for each run (default: auto-generated from filenames)
#   --time-cost MULTIPLIER         Time cost multiplier for expensive strategies (default: 5.0)
#   --include-invalid-urls         Include invalid URLs in comparison (default: exclude)
#   -o, --output DIR               Output directory for results (default: data/)
#
# Examples:
#   ./runbooks/compare.sh data/baseline_results.csv data/best_python_results.csv
#   ./runbooks/compare.sh data/baseline.csv data/best_python.csv data/browser.csv --run-names baseline python browser
#   ./runbooks/compare.sh data/run1.csv data/run2.csv --time-cost 10 --include-invalid-urls
#
# Prerequisites:
#   - Download test results CSVs with valid_url and strategy columns
#   - Python packages: pandas, matplotlib, seaborn, numpy
#
# Outputs:
#   - Uplift/falloff pattern analysis
#   - Rescuable URL analysis (excludes DNS/invalid URL failures)
#   - ROI analysis with cost/benefit metrics
#   - Comparison matrix and summary statistics
#   - Transition visualizations and charts
#

set -e  # Exit on any error

# Configuration
SCRIPTS_DIR="scripts"
RESULTS_DIR="results"
DEFAULT_OUTPUT_DIR=""

# Default options
RUN_NAMES=""
TIME_COST="5.0"
INCLUDE_INVALID=""
OUTPUT_DIR=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Parse command line arguments
INPUT_FILES=()
while [[ $# -gt 0 ]]; do
    case $1 in
        --run-names)
            shift
            RUN_NAMES=""
            while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do
                RUN_NAMES="$RUN_NAMES $1"
                shift
            done
            RUN_NAMES=${RUN_NAMES# }  # Remove leading space
            ;;
        --time-cost)
            TIME_COST="$2"
            shift 2
            ;;
        --include-invalid-urls)
            INCLUDE_INVALID="--include-invalid-urls"
            shift
            ;;
        -o|--output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 <run1.csv> <run2.csv> [run3.csv...] [options]"
            echo "Run 'head -40 $0' for full documentation"
            exit 0
            ;;
        -*)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            exit 1
            ;;
        *)
            INPUT_FILES+=("$1")
            shift
            ;;
    esac
done

# Validation
if [ ${#INPUT_FILES[@]} -lt 2 ]; then
    echo -e "${RED}❌ Need at least 2 CSV files to compare${NC}"
    echo "Usage: $0 <run1.csv> <run2.csv> [run3.csv...] [options]"
    exit 1
fi

# Check all input files exist
for file in "${INPUT_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Input file not found: $file${NC}"
        exit 1
    fi
done

# Create timestamped comparison directory
if [ -z "$OUTPUT_DIR" ]; then
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    OUTPUT_DIR="$RESULTS_DIR/comparison_$TIMESTAMP"
fi
mkdir -p "$OUTPUT_DIR"

# Setup
echo -e "${BLUE}=== MORPHIC DOWNLOAD COMPARISON RUNBOOK ===${NC}"
echo "Starting comparison analysis at $(date)"
echo

echo -e "${YELLOW}📋 Comparison Configuration:${NC}"
echo "  Input files: ${#INPUT_FILES[@]} runs"
for i in "${!INPUT_FILES[@]}"; do
    echo "    $((i+1)): ${INPUT_FILES[$i]}"
done
echo "  Run names: $([ -n "$RUN_NAMES" ] && echo "$RUN_NAMES" || echo "Auto-generated")"
echo "  Time cost multiplier: ${TIME_COST}x"
echo "  Include invalid URLs: $([ -n "$INCLUDE_INVALID" ] && echo "Yes" || echo "No")"
echo "  Output directory: $OUTPUT_DIR"
echo

# Validate files have required columns
echo -e "${YELLOW}🔍 Validating input files...${NC}"
for file in "${INPUT_FILES[@]}"; do
    HEADER=$(head -1 "$file")
    if [[ "$HEADER" != *"valid_url"* ]]; then
        echo -e "${RED}❌ File missing 'valid_url' column: $file${NC}"
        echo "Please reprocess your data with:"
        echo "  python scripts/reprocess_invalid_urls.py $file"
        exit 1
    fi
    if [[ "$HEADER" != *"strategy"* ]]; then
        echo -e "${RED}❌ File missing 'strategy' column: $file${NC}"
        echo "Please add strategy column with:"
        echo "  python scripts/reprocess_baseline_download.py $file"
        exit 1
    fi
    echo "✓ $(basename "$file") validation passed"
done

# Count total records across all files
TOTAL_RECORDS=0
for file in "${INPUT_FILES[@]}"; do
    FILE_RECORDS=$(wc -l < "$file")
    FILE_RECORDS=$((FILE_RECORDS - 1))  # Subtract header
    TOTAL_RECORDS=$((TOTAL_RECORDS + FILE_RECORDS))
    echo "✓ $(basename "$file"): $(printf "%'d" $FILE_RECORDS) records"
done
echo "✓ Total records to compare: $(printf "%'d" $TOTAL_RECORDS)"
echo

# Generate run names if not provided using smart naming conventions
if [ -z "$RUN_NAMES" ]; then
    echo -e "${YELLOW}📝 Auto-generating run names from file patterns...${NC}"
    GENERATED_NAMES=""
    for file in "${INPUT_FILES[@]}"; do
        filename=$(basename "$file")
        
        # Smart name extraction based on our conventions
        if [[ "$filename" == *"baseline"* ]]; then
            name="baseline"
        elif [[ "$filename" == *"best_python"* ]]; then
            name="best_python"
        elif [[ "$filename" == *"browser"* ]]; then
            name="browser"
        elif [[ "$filename" == *"proxy"* ]]; then
            name="proxy"
        elif [[ "$filename" == download_test_* ]]; then
            # Extract strategy from download_test_STRATEGY_...
            name=$(echo "$filename" | sed 's/download_test_\([^_]*\)_.*/\1/')
        else
            # Fallback to simplified filename (remove common prefixes/suffixes)
            name=$(echo "$filename" | sed 's/.*download_results_//; s/_reprocessed.*//; s/_with_strategy.*//; s/\.csv//' | head -c 15)
        fi
        
        GENERATED_NAMES="$GENERATED_NAMES $name"
    done
    
    # Remove leading space and set RUN_NAMES
    RUN_NAMES=${GENERATED_NAMES# }
    
    echo "✓ Generated run names: $RUN_NAMES"
else
    echo "✓ Using provided run names: $RUN_NAMES"
fi
echo

# Check if comparison script exists
COMPARE_SCRIPT="$SCRIPTS_DIR/compare_download_runs.py"
if [ ! -f "$COMPARE_SCRIPT" ]; then
    echo -e "${RED}❌ Comparison script not found: $COMPARE_SCRIPT${NC}"
    exit 1
fi

# Build comparison command
COMPARE_CMD="python $COMPARE_SCRIPT"

# Add input files
for file in "${INPUT_FILES[@]}"; do
    COMPARE_CMD="$COMPARE_CMD \"$file\""
done

# Add options
COMPARE_CMD="$COMPARE_CMD --time-cost $TIME_COST"
COMPARE_CMD="$COMPARE_CMD -o \"$OUTPUT_DIR\""

if [ -n "$RUN_NAMES" ]; then
    COMPARE_CMD="$COMPARE_CMD --run-names $RUN_NAMES"
fi

if [ -n "$INCLUDE_INVALID" ]; then
    COMPARE_CMD="$COMPARE_CMD $INCLUDE_INVALID"
fi

# Run comparison analysis
echo -e "${YELLOW}🚀 Running comparison analysis...${NC}"
echo -e "${PURPLE}Command: $COMPARE_CMD${NC}"
echo

# Execute comparison
if eval "$COMPARE_CMD"; then
    echo -e "${GREEN}✅ Comparison analysis completed successfully!${NC}"
else
    echo -e "${RED}❌ Comparison analysis failed${NC}"
    exit 1
fi

echo

# List generated outputs
echo -e "${BLUE}📁 Generated Files:${NC}"
echo "Charts and analysis files saved in: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR" 2>/dev/null || echo "Output directory not found: $OUTPUT_DIR"

echo
echo -e "${GREEN}✨ Key Results:${NC}"
echo "  📊 Comparison matrix: $OUTPUT_DIR/comparison_summary.csv"
echo "  📈 Transition charts: $OUTPUT_DIR/transition_analysis_*.png"
echo "  🎯 Rescuable analysis: $OUTPUT_DIR/rescuable_analysis_*.png"
echo "  📋 Detailed results: $OUTPUT_DIR/detailed_comparison_results.json"

echo
echo -e "${GREEN}Comparison runbook completed at $(date)${NC}"