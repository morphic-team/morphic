#!/usr/bin/env python
"""
Analyze validation funnel falloff patterns across search result ID ranges.

This script takes the comprehensive download test results and analyzes how
success rates at each validation stage vary across search_result_id ranges,
helping identify temporal clustering of bugs/issues.
"""

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import argparse
from pathlib import Path

def load_and_prepare_data(csv_file, include_invalid_urls=False):
    """Load the comprehensive test results and prepare for analysis."""
    print(f"Loading data from {csv_file}...")
    df = pd.read_csv(csv_file)
    
    # Convert search_result_id to numeric
    df['search_result_id'] = pd.to_numeric(df['search_result_id'])
    
    # Expect valid_url column to exist in the CSV
    if 'valid_url' not in df.columns:
        raise ValueError("Missing 'valid_url' column. Please reprocess your data with reprocess_invalid_urls.py first.")
    
    # Convert string values to boolean if needed
    if df['valid_url'].dtype == 'object':
        df['valid_url'] = df['valid_url'].astype(str).str.lower() == 'true'
    
    # Count invalid URLs
    invalid_count = (~df['valid_url']).sum()
    if invalid_count > 0:
        print(f"Found {invalid_count:,} invalid URLs ({invalid_count/len(df)*100:.1f}%)")
        
        if not include_invalid_urls:
            print(f"Excluding invalid URLs from analysis (use --include-invalid-urls to include)")
            df = df[df['valid_url']].copy()
            print(f"Analyzing {len(df):,} records with valid URLs")
    
    # Define the validation stages in order
    funnel_stages = []
    
    # Only include URL validity stage if we're including invalid URLs
    if include_invalid_urls:
        funnel_stages.append(('valid_url', 'Valid URL'))
    
    funnel_stages.extend([
        ('dns_resolution_success', 'DNS Resolution'),
        ('tcp_connection_success', 'TCP Connection'), 
        ('ssl_handshake_success', 'SSL Handshake'),
        ('http_request_success', 'HTTP Request'),
        ('status_code_200', 'HTTP 200 Response'),
        ('content_type_valid', 'Valid Content-Type'),
        ('binary_payload_present', 'Binary Payload'),
        ('image_format_valid', 'Valid Image Format'),
        ('final_success', 'Final Success')
    ])
    
    # Create status_code_200 column
    df['status_code_200'] = df['status_code'] == 200
    
    print(f"Loaded {len(df):,} records")
    print(f"ID range: {df['search_result_id'].min():,} to {df['search_result_id'].max():,}")
    
    return df, funnel_stages

def create_id_buckets(df, num_buckets=20):
    """Create ID range buckets for analysis."""
    min_id = df['search_result_id'].min()
    max_id = df['search_result_id'].max()
    
    # Create equal-width buckets
    bucket_edges = np.linspace(min_id, max_id, num_buckets + 1)
    df['id_bucket'] = pd.cut(df['search_result_id'], bins=bucket_edges, include_lowest=True)
    
    # Create bucket labels
    bucket_labels = []
    for i, bucket in enumerate(df['id_bucket'].cat.categories):
        start = int(bucket.left)
        end = int(bucket.right)
        bucket_labels.append(f"{start//1000}K-{end//1000}K")
    
    return df, bucket_labels

def calculate_funnel_by_bucket(df, funnel_stages):
    """Calculate success rates at each funnel stage by ID bucket."""
    results = []
    
    for bucket in df['id_bucket'].cat.categories:
        bucket_data = df[df['id_bucket'] == bucket]
        total_in_bucket = len(bucket_data)
        
        if total_in_bucket == 0:
            continue
            
        bucket_result = {
            'bucket': bucket,
            'bucket_start': int(bucket.left),
            'bucket_end': int(bucket.right),
            'total_requests': total_in_bucket
        }
        
        # Calculate success rate at each stage
        for stage_col, stage_name in funnel_stages:
            if stage_col in bucket_data.columns:
                success_count = bucket_data[stage_col].sum()
                success_rate = success_count / total_in_bucket
                bucket_result[f"{stage_name}_count"] = success_count
                bucket_result[f"{stage_name}_rate"] = success_rate
            else:
                bucket_result[f"{stage_name}_count"] = 0
                bucket_result[f"{stage_name}_rate"] = 0.0
        
        results.append(bucket_result)
    
    return pd.DataFrame(results)

def create_stacked_funnel_chart(funnel_df, funnel_stages, output_dir):
    """Create a stacked bar chart showing funnel falloff by ID bucket."""
    
    # Prepare data for stacked chart
    stage_names = [stage[1] for stage in funnel_stages]
    bucket_labels = [f"{row['bucket_start']//1000}K-{row['bucket_end']//1000}K" 
                    for _, row in funnel_df.iterrows()]
    
    # Calculate falloff at each stage (how many we lose)
    falloff_data = []
    
    for _, row in funnel_df.iterrows():
        total = row['total_requests']
        stage_falloffs = []
        
        prev_count = total
        for stage_col, stage_name in funnel_stages:
            current_count = row[f"{stage_name}_count"]
            falloff = prev_count - current_count
            stage_falloffs.append(falloff)
            prev_count = current_count
        
        # Add final success count (what remains)
        stage_falloffs.append(prev_count)
        falloff_data.append(stage_falloffs)
    
    # Create the plot
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(15, 12))
    
    # Plot 1: Stacked bar chart of falloffs
    falloff_array = np.array(falloff_data).T
    
    # Colors for each failure stage + success
    colors = plt.cm.Set3(np.linspace(0, 1, len(stage_names) + 1))
    
    bottom = np.zeros(len(bucket_labels))
    labels = [f"Lost at {stage}" for stage in stage_names] + ["Final Success"]
    
    for i, (values, label, color) in enumerate(zip(falloff_array, labels, colors)):
        ax1.bar(bucket_labels, values, bottom=bottom, label=label, color=color)
        bottom += values
    
    ax1.set_title('Image Download Funnel Falloff by Search Result ID Range', fontsize=14, fontweight='bold')
    ax1.set_xlabel('Search Result ID Range (thousands)')
    ax1.set_ylabel('Number of Requests')
    ax1.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    ax1.tick_params(axis='x', rotation=45)
    
    # Plot 2: Success rate lines for key stages
    key_stages = ['DNS Resolution', 'HTTP 200 Response', 'Valid Image Format', 'Final Success']
    
    for stage in key_stages:
        if f"{stage}_rate" in funnel_df.columns:
            ax2.plot(bucket_labels, funnel_df[f"{stage}_rate"] * 100, 
                    marker='o', linewidth=2, label=stage)
    
    ax2.set_title('Success Rates by Search Result ID Range', fontsize=14, fontweight='bold')
    ax2.set_xlabel('Search Result ID Range (thousands)')
    ax2.set_ylabel('Success Rate (%)')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    ax2.tick_params(axis='x', rotation=45)
    ax2.set_ylim(0, 100)
    
    plt.tight_layout()
    
    # Save the plot
    output_file = output_dir / 'funnel_analysis_by_id.png'
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"Saved funnel analysis chart: {output_file}")
    
    # plt.show()  # Disabled for batch processing

def create_detailed_heatmap(funnel_df, funnel_stages, output_dir, df):
    """Create protocol-specific heatmaps showing success rates across all stages and ID ranges."""
    from urllib.parse import urlparse
    
    # Extract protocols from URLs
    df['protocol'] = df['direct_link'].apply(lambda x: urlparse(str(x)).scheme if pd.notna(x) else 'unknown')
    
    # Get main protocols (skip very rare ones)
    protocol_counts = df['protocol'].value_counts()
    main_protocols = protocol_counts[protocol_counts >= 1000].index.tolist()
    
    # Prepare common elements
    stage_names = [stage[1] for stage in funnel_stages]
    bucket_labels = [f"{row['bucket_start']//1000}K-{row['bucket_end']//1000}K" 
                    for _, row in funnel_df.iterrows()]
    
    # Create overall heatmap first
    rate_matrix = []
    for stage_name in stage_names:
        if f"{stage_name}_rate" in funnel_df.columns:
            rate_matrix.append(funnel_df[f"{stage_name}_rate"].values * 100)
        else:
            rate_matrix.append(np.zeros(len(funnel_df)))
    
    rate_matrix = np.array(rate_matrix)
    
    plt.figure(figsize=(15, 8))
    sns.heatmap(rate_matrix, 
                xticklabels=bucket_labels,
                yticklabels=stage_names,
                annot=True, 
                fmt='.1f',
                cmap='RdYlGn',
                vmin=0, 
                vmax=100,
                cbar_kws={'label': 'Success Rate (%)'})
    
    plt.title('Download Success Rates by Validation Stage and ID Range (All Protocols)', 
              fontsize=14, fontweight='bold')
    plt.xlabel('Search Result ID Range (thousands)')
    plt.ylabel('Validation Stage')
    plt.xticks(rotation=45)
    plt.yticks(rotation=0)
    plt.tight_layout()
    
    # Save overall heatmap
    output_file = output_dir / 'success_rate_heatmap_overall.png'
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    plt.close()
    print(f"Saved overall success rate heatmap: {output_file}")
    
    # Create protocol-specific heatmaps
    for protocol in main_protocols:
        if protocol in ['', 'unknown']:
            continue
            
        # Filter data for this protocol
        protocol_data = df[df['protocol'] == protocol].copy()
        if len(protocol_data) < 100:  # Skip protocols with too little data
            continue
            
        # Recalculate funnel analysis for this protocol
        protocol_funnel_df = calculate_funnel_by_bucket(protocol_data, funnel_stages)
        
        # Create matrix for this protocol
        protocol_rate_matrix = []
        for stage_name in stage_names:
            if f"{stage_name}_rate" in protocol_funnel_df.columns:
                protocol_rate_matrix.append(protocol_funnel_df[f"{stage_name}_rate"].values * 100)
            else:
                protocol_rate_matrix.append(np.zeros(len(protocol_funnel_df)))
        
        protocol_rate_matrix = np.array(protocol_rate_matrix)
        
        # Create protocol-specific heatmap
        plt.figure(figsize=(15, 8))
        sns.heatmap(protocol_rate_matrix, 
                    xticklabels=bucket_labels,
                    yticklabels=stage_names,
                    annot=True, 
                    fmt='.1f',
                    cmap='RdYlGn',
                    vmin=0, 
                    vmax=100,
                    cbar_kws={'label': 'Success Rate (%)'})
        
        plt.title(f'Download Success Rates by Validation Stage and ID Range ({protocol.upper()} URLs)\n'
                 f'({len(protocol_data):,} URLs)', 
                  fontsize=14, fontweight='bold')
        plt.xlabel('Search Result ID Range (thousands)')
        plt.ylabel('Validation Stage')
        plt.xticks(rotation=45)
        plt.yticks(rotation=0)
        plt.tight_layout()
        
        # Save protocol-specific heatmap
        protocol_file = output_dir / f'success_rate_heatmap_{protocol}.png'
        plt.savefig(protocol_file, dpi=300, bbox_inches='tight')
        plt.close()
        print(f"Saved {protocol.upper()} success rate heatmap: {protocol_file}")
    
    print(f"Created heatmaps for protocols: {', '.join(main_protocols)}")
    
    # Keep the original filename for backward compatibility
    overall_legacy_file = output_dir / 'success_rate_heatmap.png'
    import shutil
    shutil.copy(str(output_file), str(overall_legacy_file))

def generate_summary_stats(funnel_df, funnel_stages):
    """Generate summary statistics about variation across ID ranges."""
    
    print("\n=== FUNNEL ANALYSIS SUMMARY ===")
    
    # Overall statistics
    total_requests = funnel_df['total_requests'].sum()
    print(f"Total requests analyzed: {total_requests:,}")
    print(f"ID buckets: {len(funnel_df)}")
    
    # Variation analysis for key stages
    key_stages = ['Final Success', 'HTTP 200 Response', 'Valid Image Format']
    
    print(f"\n📊 SUCCESS RATE VARIATION:")
    for stage in key_stages:
        rate_col = f"{stage}_rate"
        if rate_col in funnel_df.columns:
            rates = funnel_df[rate_col] * 100
            min_rate = rates.min()
            max_rate = rates.max()
            std_rate = rates.std()
            mean_rate = rates.mean()
            
            print(f"  {stage}:")
            print(f"    Mean: {mean_rate:.1f}% | Range: {min_rate:.1f}% - {max_rate:.1f}% | Std: {std_rate:.1f}%")
            
            # Identify most/least successful buckets
            min_idx = rates.idxmin()
            max_idx = rates.idxmax()
            
            print(f"    Best bucket: {funnel_df.iloc[max_idx]['bucket_start']//1000}K-{funnel_df.iloc[max_idx]['bucket_end']//1000}K ({max_rate:.1f}%)")
            print(f"    Worst bucket: {funnel_df.iloc[min_idx]['bucket_start']//1000}K-{funnel_df.iloc[min_idx]['bucket_end']//1000}K ({min_rate:.1f}%)")

def main():
    parser = argparse.ArgumentParser(description='Analyze funnel falloff by search result ID ranges')
    parser.add_argument('csv_file', help='CSV file from download test results')
    parser.add_argument('-b', '--buckets', type=int, default=20, help='Number of ID range buckets (default: 20)')
    parser.add_argument('-o', '--output', help='Output directory for charts (default: same as input file)')
    parser.add_argument('-s', '--sample', type=int, help='Sample size for analysis (default: all)')
    parser.add_argument('--random', action='store_true', help='Use random sampling instead of first N records')
    parser.add_argument('--include-invalid-urls', action='store_true', 
                        help='Include invalid URLs (x-raw-image, etc) in analysis (default: exclude)')
    
    args = parser.parse_args()
    
    # Set up output directory
    if args.output:
        output_dir = Path(args.output)
    else:
        output_dir = Path(args.csv_file).parent
    output_dir.mkdir(exist_ok=True)
    
    # Load and analyze data
    df, funnel_stages = load_and_prepare_data(args.csv_file, args.include_invalid_urls)
    
    # Apply sampling if requested
    if args.sample and args.sample < len(df):
        if args.random:
            df = df.sample(n=args.sample, random_state=42)
            print(f"Selected random sample of {args.sample:,} records")
        else:
            df = df.head(args.sample)
            print(f"Selected first {args.sample:,} records")
    
    df, bucket_labels = create_id_buckets(df, args.buckets)
    funnel_df = calculate_funnel_by_bucket(df, funnel_stages)
    
    # Generate visualizations
    create_stacked_funnel_chart(funnel_df, funnel_stages, output_dir)
    create_detailed_heatmap(funnel_df, funnel_stages, output_dir, df)
    
    # Generate summary statistics
    generate_summary_stats(funnel_df, funnel_stages)
    
    # Save detailed results
    output_csv = output_dir / 'funnel_analysis_by_id.csv'
    funnel_df.to_csv(output_csv, index=False)
    print(f"\nSaved detailed results: {output_csv}")

if __name__ == '__main__':
    main()