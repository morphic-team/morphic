#!/bin/bash
#
# Analysis Runbook - Comprehensive analysis of download test results
#
# This script runs all available analysis scripts on download test results
# and organizes outputs in the results/ directory for easy review.
#
# Usage:
#   ./runbooks/analyze.sh <download_test_results.csv> [options]
#
# Options:
#   -s, --sample SIZE          Sample size for analysis (default: all)
#   --random                   Use random sampling instead of first N records
#   --include-invalid-urls     Include invalid URLs in analyses where applicable
#   -b, --buckets NUM          Number of ID buckets for funnel analysis (default: 20)
#   --skip-protocol-trends     Skip protocol trends analysis
#   --skip-funnel              Skip funnel analysis
#   --skip-content-rot         Skip content rot analysis
#   --skip-timeout             Skip timeout analysis
#   --skip-url-quality         Skip URL quality analysis
#
# Examples:
#   ./runbooks/analyze.sh data/download_test_baseline_sample10000_20250614_065840_reprocessed_20250614_153423.csv
#   ./runbooks/analyze.sh data/results.csv -s 50000 --random --include-invalid-urls
#
# Prerequisites:
#   - Download test results CSV with valid_url column
#   - Python packages: pandas, matplotlib, seaborn, scipy, numpy
#
# Outputs:
#   - results/analysis_YYYYMMDD_HHMMSS/
#     ├── funnel_analysis_by_id.csv
#     ├── funnel_analysis_by_id.png
#     ├── success_rate_heatmap.png
#     ├── protocol_timeline.png
#     ├── protocol_trends_stats.csv
#     ├── content_rot_analysis.csv
#     ├── content_rot_by_age.png
#     ├── failure_modes_by_age.png
#     ├── half_life_analysis.png
#     ├── timeout_optimization.png
#     ├── timing_distribution.png
#     ├── url_quality_summary.json
#     └── analysis_summary.txt
#

set -e  # Exit on any error

# Configuration
DATA_DIR="data"
RESULTS_DIR="results"
SCRIPTS_DIR="scripts"

# Default options
SAMPLE_SIZE=""
RANDOM_SAMPLING=""
INCLUDE_INVALID=""
BUCKETS=20
SKIP_PROTOCOL=""
SKIP_FUNNEL=""
SKIP_CONTENT_ROT=""
SKIP_TIMEOUT=""
SKIP_URL_QUALITY=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Parse command line arguments
INPUT_FILE=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--sample)
            SAMPLE_SIZE="$2"
            shift 2
            ;;
        --random)
            RANDOM_SAMPLING="--random"
            shift
            ;;
        --include-invalid-urls)
            INCLUDE_INVALID="--include-invalid-urls"
            shift
            ;;
        -b|--buckets)
            BUCKETS="$2"
            shift 2
            ;;
        --skip-protocol-trends)
            SKIP_PROTOCOL="1"
            shift
            ;;
        --skip-funnel)
            SKIP_FUNNEL="1"
            shift
            ;;
        --skip-content-rot)
            SKIP_CONTENT_ROT="1"
            shift
            ;;
        --skip-timeout)
            SKIP_TIMEOUT="1"
            shift
            ;;
        --skip-url-quality)
            SKIP_URL_QUALITY="1"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 <download_results_csv> [options]"
            echo "Run 'head -30 $0' for full documentation"
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
    echo "Usage: $0 <download_test_results.csv>"
    exit 1
fi

if [ ! -f "$INPUT_FILE" ]; then
    echo -e "${RED}❌ Input file not found: $INPUT_FILE${NC}"
    exit 1
fi

# Setup
echo -e "${BLUE}=== MORPHIC DOWNLOAD ANALYSIS RUNBOOK ===${NC}"
echo "Starting comprehensive analysis at $(date)"
echo

# Create timestamped analysis directory
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ANALYSIS_DIR="$RESULTS_DIR/analysis_$TIMESTAMP"
mkdir -p "$ANALYSIS_DIR"

echo -e "${YELLOW}📋 Analysis Configuration:${NC}"
echo "  Input file: $INPUT_FILE"
echo "  Output directory: $ANALYSIS_DIR"
echo "  Sample size: $([ -n "$SAMPLE_SIZE" ] && echo "$(printf "%'d" $SAMPLE_SIZE)" || echo "All records")"
echo "  Random sampling: $([ -n "$RANDOM_SAMPLING" ] && echo "Yes" || echo "No")"
echo "  Include invalid URLs: $([ -n "$INCLUDE_INVALID" ] && echo "Yes" || echo "No")"
echo "  ID buckets: $BUCKETS"
echo

# Check file has required columns
echo -e "${YELLOW}🔍 Validating input file...${NC}"
HEADER=$(head -1 "$INPUT_FILE")
if [[ "$HEADER" != *"valid_url"* ]]; then
    echo -e "${RED}❌ Input file missing 'valid_url' column${NC}"
    echo "Please reprocess your data with:"
    echo "  python scripts/reprocess_invalid_urls.py $INPUT_FILE"
    exit 1
fi
echo "✓ File validation passed"

# Count records
TOTAL_RECORDS=$(wc -l < "$INPUT_FILE")
TOTAL_RECORDS=$((TOTAL_RECORDS - 1))  # Subtract header
echo "✓ Found $(printf "%'d" $TOTAL_RECORDS) records to analyze"
echo

# Build common arguments
COMMON_ARGS=""
if [ -n "$SAMPLE_SIZE" ]; then
    COMMON_ARGS="$COMMON_ARGS -s $SAMPLE_SIZE"
fi
if [ -n "$RANDOM_SAMPLING" ]; then
    COMMON_ARGS="$COMMON_ARGS $RANDOM_SAMPLING"
fi
if [ -n "$INCLUDE_INVALID" ]; then
    COMMON_ARGS="$COMMON_ARGS $INCLUDE_INVALID"
fi

# Analysis functions
run_funnel_analysis() {
    echo -e "${PURPLE}📊 Running funnel analysis...${NC}"
    python "$SCRIPTS_DIR/analyze_funnel_by_id.py" "$INPUT_FILE" \
        -o "$ANALYSIS_DIR" \
        -b "$BUCKETS" \
        $COMMON_ARGS
    echo "✓ Funnel analysis completed"
}

run_protocol_trends() {
    echo -e "${PURPLE}📈 Running protocol trends analysis...${NC}"
    python "$SCRIPTS_DIR/analyze_protocol_trends.py" "$INPUT_FILE" \
        --output-dir "$ANALYSIS_DIR" \
        $COMMON_ARGS \
        --include-invalid-urls  # Always include for protocol trends
    echo "✓ Protocol trends analysis completed"
}

run_content_rot() {
    echo -e "${PURPLE}🔗 Running content rot analysis...${NC}"
    python "$SCRIPTS_DIR/analyze_content_rot.py" "$INPUT_FILE" \
        -o "$ANALYSIS_DIR" \
        $COMMON_ARGS
    echo "✓ Content rot analysis completed"
}

run_timeout_analysis() {
    echo -e "${PURPLE}⏱️  Running timeout optimization analysis...${NC}"
    python "$SCRIPTS_DIR/analyze_timeout_tradeoffs.py" "$INPUT_FILE" \
        -o "$ANALYSIS_DIR" \
        $COMMON_ARGS
    echo "✓ Timeout analysis completed"
}

run_url_quality() {
    echo -e "${PURPLE}🔍 Running URL quality analysis...${NC}"
    python "$SCRIPTS_DIR/analyze_url_quality.py" "$INPUT_FILE" \
        --output-dir "$ANALYSIS_DIR" \
        $([ -n "$SAMPLE_SIZE" ] && echo "-s $SAMPLE_SIZE" || echo "")
    echo "✓ URL quality analysis completed"
}

# Run analyses
echo -e "${YELLOW}🚀 Running analyses...${NC}"

# Check if scripts exist before running
MISSING_SCRIPTS=""
for script in "analyze_funnel_by_id.py" "analyze_protocol_trends.py" "analyze_content_rot.py" "analyze_timeout_tradeoffs.py" "analyze_url_quality.py"; do
    if [ ! -f "$SCRIPTS_DIR/$script" ]; then
        MISSING_SCRIPTS="$MISSING_SCRIPTS $script"
    fi
done

if [ -n "$MISSING_SCRIPTS" ]; then
    echo -e "${RED}❌ Missing analysis scripts:$MISSING_SCRIPTS${NC}"
    exit 1
fi

# Run each analysis
COMPLETED_ANALYSES=()
FAILED_ANALYSES=()

if [ -z "$SKIP_FUNNEL" ]; then
    if run_funnel_analysis; then
        COMPLETED_ANALYSES+=("Funnel Analysis")
    else
        FAILED_ANALYSES+=("Funnel Analysis")
    fi
fi

if [ -z "$SKIP_PROTOCOL" ]; then
    if run_protocol_trends; then
        COMPLETED_ANALYSES+=("Protocol Trends")
    else
        FAILED_ANALYSES+=("Protocol Trends")
    fi
fi

if [ -z "$SKIP_CONTENT_ROT" ]; then
    if run_content_rot; then
        COMPLETED_ANALYSES+=("Content Rot")
    else
        FAILED_ANALYSES+=("Content Rot")
    fi
fi

if [ -z "$SKIP_TIMEOUT" ]; then
    if run_timeout_analysis; then
        COMPLETED_ANALYSES+=("Timeout Optimization")
    else
        FAILED_ANALYSES+=("Timeout Optimization")
    fi
fi

if [ -z "$SKIP_URL_QUALITY" ]; then
    if run_url_quality; then
        COMPLETED_ANALYSES+=("URL Quality")
    else
        FAILED_ANALYSES+=("URL Quality")
    fi
fi

echo

# Generate summary report
SUMMARY_FILE="$ANALYSIS_DIR/analysis_summary.txt"
echo -e "${YELLOW}📝 Generating analysis summary...${NC}"

cat > "$SUMMARY_FILE" << EOF
MORPHIC IMAGE DOWNLOAD ANALYSIS SUMMARY
======================================

Analysis completed: $(date)
Input file: $INPUT_FILE
Output directory: $ANALYSIS_DIR

Configuration:
- Total records: $(printf "%'d" $TOTAL_RECORDS)
- Sample size: $([ -n "$SAMPLE_SIZE" ] && echo "$(printf "%'d" $SAMPLE_SIZE)" || echo "All records")
- Random sampling: $([ -n "$RANDOM_SAMPLING" ] && echo "Yes" || echo "No")
- Include invalid URLs: $([ -n "$INCLUDE_INVALID" ] && echo "Yes" || echo "No")
- ID buckets: $BUCKETS

Completed Analyses:
EOF

for analysis in "${COMPLETED_ANALYSES[@]}"; do
    echo "✓ $analysis" >> "$SUMMARY_FILE"
done

if [ ${#FAILED_ANALYSES[@]} -gt 0 ]; then
    echo "" >> "$SUMMARY_FILE"
    echo "Failed Analyses:" >> "$SUMMARY_FILE"
    for analysis in "${FAILED_ANALYSES[@]}"; do
        echo "❌ $analysis" >> "$SUMMARY_FILE"
    done
fi

cat >> "$SUMMARY_FILE" << EOF

Generated Files:
$(ls -la "$ANALYSIS_DIR" | tail -n +2)

Analysis Overview:
- Funnel Analysis: Shows success rates at each validation stage by ID range
- Protocol Trends: Displays http/https/x-raw-image distribution over time
- Content Rot: Analyzes link decay patterns and content degradation
- Timeout Analysis: Optimization recommendations for request timeouts
- URL Quality: Breakdown of URL schemes, domains, and anomalies

Next Steps:
1. Review charts and CSV files in $ANALYSIS_DIR
2. Check protocol_trends_stats.csv for x-raw-image spike timing
3. Use funnel analysis to identify systematic failure patterns
4. Apply timeout optimization recommendations to improve success rates
EOF

# Display final results
echo -e "${GREEN}✅ Analysis completed successfully!${NC}"
echo

echo "📊 Analysis Summary:"
echo "  Completed: ${#COMPLETED_ANALYSES[@]} analyses"
if [ ${#FAILED_ANALYSES[@]} -gt 0 ]; then
    echo -e "  ${RED}Failed: ${#FAILED_ANALYSES[@]} analyses${NC}"
fi
echo "  Output directory: $ANALYSIS_DIR"
echo "  Summary report: $SUMMARY_FILE"
echo

echo -e "${BLUE}📁 Generated Files:${NC}"
ls -la "$ANALYSIS_DIR"
echo

if [ ${#COMPLETED_ANALYSES[@]} -gt 0 ]; then
    echo -e "${GREEN}✨ Key findings available in:${NC}"
    echo "  📊 Charts: $ANALYSIS_DIR/*.png"
    echo "  📋 Data: $ANALYSIS_DIR/*.csv"
    echo "  📝 Summary: $SUMMARY_FILE"
fi

echo
echo -e "${GREEN}Analysis runbook completed at $(date)${NC}"