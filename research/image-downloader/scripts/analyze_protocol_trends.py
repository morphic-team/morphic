#!/usr/bin/env python
"""
Analyze protocol distribution trends over time (search result ID).

This script analyzes how URL protocols (http, https, x-raw-image) change
over the progression of search result IDs, helping identify when certain
protocols were introduced or phased out.
"""

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import argparse
from pathlib import Path
from urllib.parse import urlparse

def load_and_prepare_data(csv_file, sample_size=None, include_invalid_urls=True):
    """Load search results and extract protocol information."""
    print(f"Loading data from {csv_file}...")
    
    # Read what we need including valid_url column
    required_cols = ['search_result_id', 'direct_link', 'valid_url']
    if sample_size:
        df = pd.read_csv(csv_file, usecols=required_cols, nrows=sample_size)
    else:
        df = pd.read_csv(csv_file, usecols=required_cols)
    
    # Expect valid_url column to exist
    if 'valid_url' not in df.columns:
        raise ValueError("Missing 'valid_url' column. Please reprocess your data with reprocess_invalid_urls.py first.")
    
    # Convert string values to boolean if needed
    if df['valid_url'].dtype == 'object':
        df['valid_url'] = df['valid_url'].astype(str).str.lower() == 'true'
    
    print(f"Loaded {len(df):,} records")
    
    # Filter invalid URLs if requested
    invalid_count = (~df['valid_url']).sum()
    if invalid_count > 0:
        print(f"Found {invalid_count:,} invalid URLs ({invalid_count/len(df)*100:.1f}%)")
        
        if not include_invalid_urls:
            print(f"Excluding invalid URLs from analysis (use --include-invalid-urls to include)")
            df = df[df['valid_url']].copy()
            print(f"Analyzing {len(df):,} records with valid URLs")
    
    # Extract protocol from URLs
    def get_protocol(url):
        try:
            parsed = urlparse(url)
            return parsed.scheme.lower() if parsed.scheme else 'no_scheme'
        except:
            return 'parse_error'
    
    df['protocol'] = df['direct_link'].apply(get_protocol)
    
    # Convert ID to numeric and sort
    df['search_result_id'] = pd.to_numeric(df['search_result_id'])
    df = df.sort_values('search_result_id')
    
    print(f"ID range: {df['search_result_id'].min():,} to {df['search_result_id'].max():,}")
    print(f"\nProtocol distribution:")
    print(df['protocol'].value_counts())
    
    return df

def create_protocol_timeline(df, output_dir):
    """Create timeline visualization of protocol distribution."""
    
    # Create ID buckets (100 buckets for smooth visualization)
    num_buckets = 100
    df['id_bucket'] = pd.cut(df['search_result_id'], bins=num_buckets, include_lowest=True)
    
    # Calculate protocol percentages per bucket
    protocol_by_bucket = []
    
    for bucket in df['id_bucket'].cat.categories:
        bucket_data = df[df['id_bucket'] == bucket]
        if len(bucket_data) == 0:
            continue
            
        total = len(bucket_data)
        bucket_center = (bucket.left + bucket.right) / 2
        
        # Count each protocol
        for protocol in ['http', 'https', 'x-raw-image']:
            count = (bucket_data['protocol'] == protocol).sum()
            protocol_by_bucket.append({
                'bucket_center': bucket_center,
                'bucket_label': f"{int(bucket.left/1000)}k-{int(bucket.right/1000)}k",
                'protocol': protocol,
                'count': count,
                'percentage': (count / total) * 100
            })
    
    timeline_df = pd.DataFrame(protocol_by_bucket)
    
    # Create the plot
    plt.figure(figsize=(16, 10))
    
    # Main plot: Stacked area chart
    plt.subplot(2, 1, 1)
    
    # Pivot for stacked area chart
    pivot_df = timeline_df.pivot(index='bucket_center', columns='protocol', values='percentage').fillna(0)
    
    # Plot stacked area
    protocols = ['https', 'http', 'x-raw-image']
    colors = {'https': '#2ca02c', 'http': '#ff7f0e', 'x-raw-image': '#d62728'}
    
    # Ensure all protocols exist in pivot_df
    for protocol in protocols:
        if protocol not in pivot_df.columns:
            pivot_df[protocol] = 0
    
    plt.stackplot(pivot_df.index, 
                  [pivot_df[p] for p in protocols if p in pivot_df.columns],
                  labels=[p for p in protocols if p in pivot_df.columns],
                  colors=[colors[p] for p in protocols if p in pivot_df.columns],
                  alpha=0.7)
    
    plt.xlabel('Search Result ID')
    plt.ylabel('Protocol Distribution (%)')
    plt.title('URL Protocol Distribution Over Time (Search Result IDs)', fontsize=14, fontweight='bold')
    plt.legend(loc='upper right')
    plt.grid(True, alpha=0.3)
    plt.xlim(pivot_df.index.min(), pivot_df.index.max())
    plt.ylim(0, 100)
    
    # Format x-axis
    ax = plt.gca()
    ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{int(x/1000)}k'))
    
    # Subplot 2: Line chart for better trend visibility
    plt.subplot(2, 1, 2)
    
    for protocol in protocols:
        if protocol in pivot_df.columns:
            plt.plot(pivot_df.index, pivot_df[protocol], 
                    label=protocol, color=colors[protocol], linewidth=2, marker='o', markersize=3)
    
    plt.xlabel('Search Result ID')
    plt.ylabel('Protocol Percentage (%)')
    plt.title('Protocol Trends Over Time', fontsize=14, fontweight='bold')
    plt.legend(loc='center right')
    plt.grid(True, alpha=0.3)
    plt.xlim(pivot_df.index.min(), pivot_df.index.max())
    
    # Format x-axis
    ax = plt.gca()
    ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{int(x/1000)}k'))
    
    plt.tight_layout()
    
    # Save plot
    output_file = output_dir / 'protocol_timeline.png'
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"\nTimeline plot saved to: {output_file}")
    
    # Create detailed statistics
    stats = []
    
    # Find when x-raw-image appears and disappears
    x_raw_data = df[df['protocol'] == 'x-raw-image']['search_result_id']
    if len(x_raw_data) > 0:
        stats.append({
            'metric': 'x-raw-image first appearance',
            'value': f"ID {x_raw_data.min():,}"
        })
        stats.append({
            'metric': 'x-raw-image last appearance',
            'value': f"ID {x_raw_data.max():,}"
        })
        stats.append({
            'metric': 'x-raw-image total count',
            'value': f"{len(x_raw_data):,}"
        })
    
    # HTTPS adoption over time
    quartiles = df['search_result_id'].quantile([0.25, 0.5, 0.75])
    for q, qname in zip([0.25, 0.5, 0.75], ['Q1', 'Q2', 'Q3']):
        q_data = df[df['search_result_id'] <= quartiles[q]]
        https_pct = (q_data['protocol'] == 'https').mean() * 100
        stats.append({
            'metric': f'HTTPS % in {qname} (ID ≤ {int(quartiles[q]):,})',
            'value': f"{https_pct:.1f}%"
        })
    
    # Recent trends (last 10% of data)
    recent_threshold = df['search_result_id'].quantile(0.9)
    recent_data = df[df['search_result_id'] >= recent_threshold]
    for protocol in ['https', 'http', 'x-raw-image']:
        pct = (recent_data['protocol'] == protocol).mean() * 100
        stats.append({
            'metric': f'{protocol} % in recent data (ID ≥ {int(recent_threshold):,})',
            'value': f"{pct:.1f}%"
        })
    
    stats_df = pd.DataFrame(stats)
    stats_file = output_dir / 'protocol_trends_stats.csv'
    stats_df.to_csv(stats_file, index=False)
    print(f"Statistics saved to: {stats_file}")
    
    return timeline_df, stats_df

def main():
    parser = argparse.ArgumentParser(description='Analyze protocol distribution trends over time')
    parser.add_argument('csv_file', help='Path to search results CSV file')
    parser.add_argument('-s', '--sample', type=int, help='Sample size to analyze (default: all)')
    parser.add_argument('-o', '--output-dir', type=Path, 
                        help='Output directory for results (default: results/)')
    parser.add_argument('--include-invalid-urls', action='store_true', 
                        help='Include invalid URLs (x-raw-image, etc) in analysis (default: include for protocol trends)')
    
    args = parser.parse_args()
    
    # Set output directory
    output_dir = args.output_dir or Path('results')
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Load and analyze data - for protocol trends, we want to see invalid URLs by default
    include_invalid = getattr(args, 'include_invalid_urls', True)
    df = load_and_prepare_data(args.csv_file, args.sample, include_invalid)
    
    # Create visualizations
    timeline_df, stats_df = create_protocol_timeline(df, output_dir)
    
    # Print summary statistics
    print("\n" + "="*60)
    print("PROTOCOL TREND STATISTICS")
    print("="*60)
    for _, row in stats_df.iterrows():
        print(f"{row['metric']:.<50} {row['value']}")

if __name__ == '__main__':
    main()