# Analysis Scripts Documentation

This document provides comprehensive documentation for all analysis scripts in the image download research project.

## Overview

The analysis scripts are designed to process the comprehensive download test data and extract insights about web content reliability, failure patterns, and optimization opportunities.

## Data Pipeline

```
1. Export data      → backend/scripts/export_search_results.py
2. Baseline testing → scripts/baseline_download_test.py  
3. Analysis         → scripts/analyze_*.py
4. Visualizations   → results/*.png + *.csv
```

## Scripts Reference

### 1. Baseline Download Testing

#### `baseline_download_test.py`
**Purpose**: Comprehensive download testing with detailed validation at every network stack level.

**Usage**:
```bash
python scripts/baseline_download_test.py data/search_results.csv [options]
```

**Key Options**:
- `--sample N` - Test only N records (for faster iteration)
- `--random` - Random sampling instead of first N records
- `--workers N` - Number of concurrent workers (default: 10)
- `--timeout N` - Request timeout in seconds (default: 10)
- `--output FILE` - Output CSV file name

**Output Format**: 
- **Wide CSV**: ~40 columns with detailed metrics per image
- **Summary JSON**: Aggregate statistics and analysis
- **Console Report**: Key metrics and top failure patterns

**Validation Stages**:
1. DNS Resolution
2. TCP Connection  
3. SSL Handshake
4. HTTP Request
5. HTTP 200 Response
6. Valid Content-Type
7. Binary Payload Present
8. Valid Image Format
9. Final Success

**Key Metrics**:
- Timing: DNS resolution, TTFB, total download time
- Content: File size, image dimensions, format, MD5 hash
- Headers: Server type, cache headers, content encoding
- Errors: Detailed failure stage and error classification

### 2. Funnel Analysis by ID Range

#### `analyze_funnel_by_id.py`
**Purpose**: Analyze validation funnel success rates across search result ID ranges to identify temporal clustering of failures.

**Usage**:
```bash
python scripts/analyze_funnel_by_id.py results/baseline_test_results.csv [options]
```

**Options**:
- `--buckets N` - Number of ID range buckets (default: 20)
- `--output DIR` - Output directory for charts

**Generated Visualizations**:
1. **Stacked Bar Chart**: Funnel falloff by ID range
   - Shows where requests fail at each validation stage
   - Identifies ID ranges with systematic issues

2. **Success Rate Lines**: Key metrics over ID ranges  
   - DNS, HTTP 200, Valid Images, Final Success rates
   - Reveals temporal patterns in data quality

3. **Heatmap**: Success rates across all stages and ID ranges
   - Easy identification of problematic periods
   - Color-coded performance matrix

**Key Insights**:
- Temporal clustering of failures (bug archaeology)
- Validation stage performance over time
- Identification of systematic data quality issues

**Output Files**:
- `funnel_analysis_by_id.png` - Main chart
- `success_rate_heatmap.png` - Detailed heatmap
- `funnel_analysis_by_id.csv` - Detailed statistics

### 3. Timeout Optimization Analysis

#### `analyze_timeout_tradeoffs.py`
**Purpose**: Analyze download timing patterns and optimize timeout settings for speed vs coverage trade-offs.

**Usage**:
```bash
python scripts/analyze_timeout_tradeoffs.py results/baseline_test_results.csv [options]
```

**Options**:
- `--max-timeout N` - Maximum timeout to analyze (default: 30s)
- `--output DIR` - Output directory for charts

**Generated Visualizations**:
1. **Download Time Distribution**:
   - Histogram of successful download times (log scale)
   - Percentile markers (P50, P90, P95, P99)
   - Cumulative distribution showing completion rates over time

2. **Timeout Optimization Charts**:
   - Success retention rate vs timeout threshold
   - Average response time of retained requests
   - Annotations for key timeout values (5s, 10s, 15s, 20s)

3. **Speed vs Coverage Trade-off**:
   - Pareto frontier visualization
   - Color-coded by timeout value
   - Guidance lines for 90%, 95% retention targets

4. **Success vs Failed Timing Comparison**:
   - Overlapping histograms of timing patterns
   - Identifies if failed requests are slow or genuinely broken

**Key Insights**:
- Optimal timeout settings for different retention targets
- Speed improvements possible with timeout reduction
- Distribution of request completion times
- Identification of genuinely slow vs broken requests

**Recommendations Generated**:
- Timeout for 90%, 95%, 99% success retention
- Most efficient timeout (best speed gain per success lost)
- Speed improvement percentages vs current settings

**Output Files**:
- `download_timing_analysis.png` - Distribution analysis
- `timeout_optimization_analysis.png` - Optimization charts
- `speed_vs_coverage_tradeoff.png` - Pareto frontier
- `timeout_analysis_results.csv` - Detailed metrics

### 4. Content Rot Analysis

#### `analyze_content_rot.py`
**Purpose**: Analyze content decay (link rot) patterns over time using search result ID as a proxy for content age.

**Usage**:
```bash
python scripts/analyze_content_rot.py results/baseline_test_results.csv [options]
```

**Options**:
- `--age-buckets N` - Number of age buckets (default: 20)
- `--output DIR` - Output directory for charts

**Generated Visualizations**:
1. **Content Rot Overview**:
   - Original vs current success rates by age
   - Degradation rate trend by age bucket
   - Content retention rate over time
   - Absolute count of degraded links

2. **Failure Mode Evolution**:
   - Stacked bar chart showing how failure types change with content age
   - Breakdown of degradation patterns (404s, timeouts, etc.)

3. **Content Half-Life Analysis**:
   - Exponential decay modeling of content retention
   - Half-life calculation (when retention drops to 50%)
   - Trend line fitting with model parameters

**Key Metrics**:
- **Degradation Rate**: % of originally successful content now failed
- **Retention Rate**: Current success rate / Original success rate  
- **Half-Life**: Age bucket where retention drops to 50%
- **Failure Mode Distribution**: How degradation reasons change over time

**Statistical Analysis**:
- Correlation between age and degradation rates
- P-value significance testing
- Relative risk calculations (oldest vs newest content)

**Key Insights**:
- Quantified web content decay rates
- Identification of accelerating vs linear decay patterns
- Domain-specific aging patterns
- Most common causes of content degradation

**Output Files**:
- `content_rot_overview.png` - Main analysis charts
- `failure_modes_by_age.png` - Degradation pattern evolution
- `content_half_life_analysis.png` - Decay modeling
- `content_rot_analysis.csv` - Detailed age bucket statistics

## Common Usage Patterns

### Quick Analysis Workflow
```bash
# 1. Test sample for quick iteration
python scripts/baseline_download_test.py data/export.csv --sample 1000 --workers 20

# 2. Run all analyses on sample
python scripts/analyze_funnel_by_id.py results/baseline_results_sample1000.csv
python scripts/analyze_timeout_tradeoffs.py results/baseline_results_sample1000.csv
python scripts/analyze_content_rot.py results/baseline_results_sample1000.csv
```

### Full Production Analysis
```bash
# 1. Full dataset testing
python scripts/baseline_download_test.py data/export.csv --workers 50

# 2. Comprehensive analysis suite
python scripts/analyze_funnel_by_id.py results/baseline_results.csv --buckets 50
python scripts/analyze_timeout_tradeoffs.py results/baseline_results.csv --max-timeout 60
python scripts/analyze_content_rot.py results/baseline_results.csv --age-buckets 30
```

## Data Requirements

### Input Data Format
All analysis scripts expect CSV data from `baseline_download_test.py` with these key columns:
- `search_result_id` - Unique identifier (used as age proxy)
- `original_state` - Historical success/failure status
- `final_success` - Current test outcome
- Validation stage columns (`dns_resolution_success`, etc.)
- Timing columns (`total_download_time_ms`, etc.)
- Content validation columns (`image_format_valid`, etc.)

### Dependencies
```bash
pip install pandas matplotlib seaborn numpy scipy pillow requests dnspython
```

## Performance Considerations

### Memory Usage
- **Funnel Analysis**: Low memory usage, handles large datasets well
- **Timeout Analysis**: Moderate memory for timing arrays
- **Content Rot**: Low memory usage with chunked processing

### Processing Time
- **Baseline Testing**: ~10-60 req/sec depending on workers and timeouts
- **Analysis Scripts**: <1 minute for 100k records, <10 minutes for 1M records

### Scalability Tips
- Use sampling (`--sample`) for iterative development
- Increase workers for baseline testing on high-bandwidth connections
- Process analysis in chunks for extremely large datasets (>1M records)

## Conference Presentation Integration

### Key Visualizations for Presentation
1. **Funnel Analysis**: Shows systematic vs random failures
2. **Content Rot**: Quantifies web decay with "half-life" concept
3. **Timeout Optimization**: Demonstrates data-driven optimization
4. **Domain Analysis**: Reveals hosting quality tiers

### Narrative Structure
1. **Problem**: Web content reliability crisis
2. **Method**: Systematic validation funnel analysis
3. **Discovery**: Temporal clustering reveals software archaeology
4. **Insights**: Content decay, optimization opportunities
5. **Impact**: Quantified improvements and recommendations

### Memorable Metrics
- "Pierrekin's Constant": ~33% baseline failure rate
- "Web Content Half-Life": X age buckets for 50% retention
- "5-Second Rule": Optimal timeout for 95% retention
- "Failure Fingerprints": Clustered patterns by domain/era