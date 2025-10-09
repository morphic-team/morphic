# Image Download Analysis Research

This directory contains the scientific analysis of image download success rates and failure patterns for the Morphic project. The research quantifies web content reliability and decay patterns across ~500k real-world image URLs.

## Directory Structure

```
research/image-downloader/
├── scripts/          # Analysis scripts
├── docs/             # Documentation and research notes
├── data/             # Raw and processed data files
└── results/          # Generated visualizations and reports
```

## Research Goals

1. **Quantify baseline success rates** for web image downloads
2. **Identify failure patterns** and their root causes
3. **Analyze content decay** (link rot) over time
4. **Optimize download strategies** based on empirical data
5. **Create predictive models** for download success

## Key Findings (Preliminary)

- **"Pierrekin's Constant"**: Approximately 1/3 of web image links fail
- **Temporal clustering**: Failures cluster by time periods (likely due to historical bugs)
- **Content decay**: Older content shows significantly higher failure rates
- **Domain patterns**: Success rates vary dramatically by hosting provider

## Scripts

### Data Collection
- `export_search_results.py` - Export SearchResult data from production database
- `baseline_download_test.py` - Comprehensive download testing with detailed metrics

### Analysis Scripts
- `analyze_funnel_by_id.py` - Validation funnel analysis by search result ID ranges
- `analyze_timeout_tradeoffs.py` - Timeout optimization and timing analysis
- `analyze_content_rot.py` - Content decay and link rot patterns over time

## Usage

1. **Export data from production:**
   ```bash
   python scripts/export_search_results.py --output data/search_results.csv
   ```

2. **Run baseline download tests:**
   ```bash
   python scripts/baseline_download_test.py data/search_results.csv --workers 50
   ```

3. **Analyze results:**
   ```bash
   python scripts/analyze_funnel_by_id.py results/baseline_download_results.csv
   python scripts/analyze_timeout_tradeoffs.py results/baseline_download_results.csv
   python scripts/analyze_content_rot.py results/baseline_download_results.csv
   ```

## Conference Presentation

This research is being prepared for conference presentation, demonstrating:
- Systematic analysis of web content reliability
- Data archaeology revealing software quality impacts
- Actionable insights for improving content availability
- Novel clustering approaches to failure pattern identification

## Dependencies

```bash
pip install requests pandas matplotlib seaborn numpy pillow dnspython
```

## Next Steps

See `docs/analysis_ideas.md` for additional analysis approaches, including:
- Machine learning clustering of failure patterns
- Domain reliability scoring
- Predictive failure modeling