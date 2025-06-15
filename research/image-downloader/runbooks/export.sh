#!/bin/bash
"""
Export Runbook - Extract search results data from production database

This script exports search results from the production Morphic database
and saves the raw data to the data/ directory for analysis.

Usage:
  ./runbooks/export.sh

Prerequisites:
  - Access to production Morphic database
  - Backend environment configured
  - Required Python packages installed

Outputs:
  - data/search_results_export_YYYYMMDD_HHMMSS.csv
"""

set -e  # Exit on any error

# Configuration
DATA_DIR="data"
BACKEND_DIR="../backend"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="$DATA_DIR/search_results_export_$TIMESTAMP.csv"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== MORPHIC SEARCH RESULTS EXPORT RUNBOOK ===${NC}"
echo "Starting export at $(date)"
echo

# Create data directory
echo -e "${YELLOW}📁 Setting up directories...${NC}"
mkdir -p "$DATA_DIR"
echo "✓ Created $DATA_DIR/"

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}❌ Backend directory not found at $BACKEND_DIR${NC}"
    echo "Please ensure you're running from the research/image-downloader directory"
    echo "and that the backend submodule is properly initialized:"
    echo "  git submodule init"
    echo "  git submodule update"
    exit 1
fi

# Check for export script
EXPORT_SCRIPT="$BACKEND_DIR/scripts/export_search_results.py"
if [ ! -f "$EXPORT_SCRIPT" ]; then
    echo -e "${RED}❌ Export script not found at $EXPORT_SCRIPT${NC}"
    echo "Please ensure the backend export script exists"
    exit 1
fi

# Run the export
echo -e "${YELLOW}📊 Exporting search results from database...${NC}"
echo "Output file: $OUTPUT_FILE"
echo

cd "$BACKEND_DIR"
python scripts/export_search_results.py --output "../research/image-downloader/$OUTPUT_FILE"
cd - > /dev/null

# Verify export
if [ ! -f "$OUTPUT_FILE" ]; then
    echo -e "${RED}❌ Export failed - output file not created${NC}"
    exit 1
fi

# Get file size and record count
FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
RECORD_COUNT=$(wc -l < "$OUTPUT_FILE")
RECORD_COUNT=$((RECORD_COUNT - 1))  # Subtract header row

echo -e "${GREEN}✅ Export completed successfully!${NC}"
echo
echo "📋 Export Summary:"
echo "  File: $OUTPUT_FILE"
echo "  Size: $FILE_SIZE"
echo "  Records: $(printf "%'d" $RECORD_COUNT)"
echo "  Exported at: $(date)"
echo

echo -e "${BLUE}📝 Next Steps:${NC}"
echo "1. Run download tests:"
echo "   ./runbooks/download.sh $OUTPUT_FILE"
echo "2. Or run analysis on existing results:"
echo "   ./runbooks/analyze.sh <download_results.csv>"
echo

echo -e "${GREEN}Export runbook completed at $(date)${NC}"