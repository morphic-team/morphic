#!/usr/bin/env python
"""
Analyze download timing patterns and timeout optimization trade-offs.

This script analyzes the relationship between download times and success rates,
showing how reducing timeouts would affect overall success while improving speed.
"""

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import argparse
from pathlib import Path

def load_and_prepare_timing_data(csv_file, include_invalid_urls=False):
    """Load test results and prepare timing analysis data."""
    print(f"Loading data from {csv_file}...")
    df = pd.read_csv(csv_file)
    
    # Expect valid_url column to exist
    if 'valid_url' not in df.columns:
        raise ValueError("Missing 'valid_url' column. Please reprocess your data with reprocess_invalid_urls.py first.")
    
    # Convert string values to boolean if needed
    if df['valid_url'].dtype == 'object':
        df['valid_url'] = df['valid_url'].astype(str).str.lower() == 'true'
    
    # Filter invalid URLs if requested
    invalid_count = (~df['valid_url']).sum()
    if invalid_count > 0:
        print(f"Found {invalid_count:,} invalid URLs ({invalid_count/len(df)*100:.1f}%)")
        
        if not include_invalid_urls:
            print(f"Excluding invalid URLs from analysis (use --include-invalid-urls to include)")
            df = df[df['valid_url']].copy()
            print(f"Analyzing {len(df):,} records with valid URLs")
    
    # Convert timing columns to numeric, handling any NaN values
    timing_cols = ['total_download_time_ms', 'time_to_first_byte_ms', 'dns_resolution_time_ms']
    for col in timing_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Convert to seconds for easier interpretation
    df['total_download_time_s'] = df['total_download_time_ms'] / 1000
    df['time_to_first_byte_s'] = df['time_to_first_byte_ms'] / 1000
    df['dns_resolution_time_s'] = df['dns_resolution_time_ms'] / 1000
    
    print(f"Loaded {len(df):,} records")
    
    # Summary of timing data availability
    successful = df[df['final_success'] == True]
    failed = df[df['final_success'] == False]
    
    print(f"Successful requests: {len(successful):,}")
    print(f"Failed requests: {len(failed):,}")
    
    if len(successful) > 0:
        print(f"Successful download times - Min: {successful['total_download_time_s'].min():.2f}s, "
              f"Max: {successful['total_download_time_s'].max():.2f}s, "
              f"Mean: {successful['total_download_time_s'].mean():.2f}s")
    
    return df, successful, failed

def analyze_timeout_impact(successful_df, timeout_thresholds=None):
    """Analyze how different timeout values would affect success rates."""
    
    if timeout_thresholds is None:
        # Create timeout thresholds from 0.5s to 30s
        timeout_thresholds = [0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30]
    
    # Filter out any records without timing data
    timing_data = successful_df.dropna(subset=['total_download_time_s'])
    total_successful = len(timing_data)
    
    if total_successful == 0:
        print("Warning: No timing data available for successful requests")
        return pd.DataFrame()
    
    results = []
    
    for timeout in timeout_thresholds:
        # Count how many successful requests would still succeed with this timeout
        would_succeed = timing_data[timing_data['total_download_time_s'] <= timeout]
        success_count = len(would_succeed)
        success_rate = success_count / total_successful
        excluded_count = total_successful - success_count
        excluded_rate = excluded_count / total_successful
        
        # Calculate timing stats for requests that would succeed
        if len(would_succeed) > 0:
            avg_time = would_succeed['total_download_time_s'].mean()
            p95_time = would_succeed['total_download_time_s'].quantile(0.95)
        else:
            avg_time = 0
            p95_time = 0
        
        results.append({
            'timeout_s': timeout,
            'retained_successes': success_count,
            'retention_rate': success_rate,
            'excluded_successes': excluded_count,
            'exclusion_rate': excluded_rate,
            'avg_time_s': avg_time,
            'p95_time_s': p95_time
        })
    
    return pd.DataFrame(results)

def create_timing_distribution_plot(successful_df, failed_df, output_dir):
    """Create histogram showing distribution of download times for successful vs failed requests."""
    
    fig, (ax1, ax2, ax3) = plt.subplots(3, 1, figsize=(12, 15))
    
    # Plot 1: Distribution of successful download times
    success_times = successful_df.dropna(subset=['total_download_time_s'])['total_download_time_s']
    
    if len(success_times) > 0:
        # Create bins with focus on lower times
        bins = np.logspace(-1, 2, 50)  # 0.1s to 100s, log scale
        
        ax1.hist(success_times, bins=bins, alpha=0.7, color='green', edgecolor='black')
        ax1.set_xscale('log')
        ax1.set_xlabel('Download Time (seconds, log scale)')
        ax1.set_ylabel('Number of Successful Downloads')
        ax1.set_title('Distribution of Successful Download Times', fontweight='bold')
        ax1.grid(True, alpha=0.3)
        
        # Add percentile lines
        percentiles = [50, 90, 95, 99]
        colors = ['blue', 'orange', 'red', 'purple']
        for p, color in zip(percentiles, colors):
            pct_value = np.percentile(success_times, p)
            ax1.axvline(pct_value, color=color, linestyle='--', 
                       label=f'P{p}: {pct_value:.2f}s')
        ax1.legend()
    
    # Plot 2: Cumulative distribution
    if len(success_times) > 0:
        sorted_times = np.sort(success_times)
        cumulative_pct = np.arange(1, len(sorted_times) + 1) / len(sorted_times) * 100
        
        ax2.plot(sorted_times, cumulative_pct, linewidth=2, color='green')
        ax2.set_xlabel('Download Time (seconds)')
        ax2.set_ylabel('Cumulative Percentage of Successes')
        ax2.set_title('Cumulative Distribution: How Many Successes Complete by Time X', fontweight='bold')
        ax2.grid(True, alpha=0.3)
        ax2.set_xlim(0, min(30, sorted_times.max()))  # Focus on 0-30s range
        
        # Add common timeout markers
        common_timeouts = [5, 10, 15, 20, 30]
        for timeout in common_timeouts:
            if timeout <= sorted_times.max():
                pct_at_timeout = np.sum(sorted_times <= timeout) / len(sorted_times) * 100
                ax2.axvline(timeout, color='red', linestyle='--', alpha=0.7)
                ax2.text(timeout, pct_at_timeout + 5, f'{timeout}s\n{pct_at_timeout:.1f}%', 
                        ha='center', va='bottom', fontsize=9, 
                        bbox=dict(boxstyle='round,pad=0.3', facecolor='white', alpha=0.8))
    
    # Plot 3: Comparison of successful vs failed timing patterns
    # For failed requests, we'll look at how long they took before failing
    failed_times = failed_df.dropna(subset=['total_download_time_s'])['total_download_time_s']
    
    if len(success_times) > 0 and len(failed_times) > 0:
        # Create overlapping histograms
        bins = np.linspace(0, 30, 30)  # 0-30s in 1s bins
        
        ax3.hist(success_times[success_times <= 30], bins=bins, alpha=0.6, 
                color='green', label=f'Successful ({len(success_times):,})', density=True)
        ax3.hist(failed_times[failed_times <= 30], bins=bins, alpha=0.6, 
                color='red', label=f'Failed ({len(failed_times):,})', density=True)
        
        ax3.set_xlabel('Time Before Success/Failure (seconds)')
        ax3.set_ylabel('Density')
        ax3.set_title('Download Time Patterns: Successful vs Failed Requests', fontweight='bold')
        ax3.legend()
        ax3.grid(True, alpha=0.3)
    elif len(success_times) > 0:
        # Only successful data available
        bins = np.linspace(0, 30, 30)
        ax3.hist(success_times[success_times <= 30], bins=bins, alpha=0.7, 
                color='green', edgecolor='black')
        ax3.set_xlabel('Download Time (seconds)')
        ax3.set_ylabel('Number of Requests')
        ax3.set_title('Successful Download Times (0-30s range)', fontweight='bold')
        ax3.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    # Save the plot
    output_file = output_dir / 'download_timing_analysis.png'
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"Saved timing distribution analysis: {output_file}")
    
    # plt.show()  # Disabled for batch processing

def create_timeout_optimization_plot(timeout_analysis_df, output_dir):
    """Create plots showing timeout vs success rate trade-offs."""
    
    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 10))
    
    # Plot 1: Success retention vs timeout
    ax1.plot(timeout_analysis_df['timeout_s'], timeout_analysis_df['retention_rate'] * 100, 
             marker='o', linewidth=3, markersize=6, color='green')
    
    ax1.set_xlabel('Timeout Threshold (seconds)')
    ax1.set_ylabel('Success Retention Rate (%)')
    ax1.set_title('Success Retention vs Timeout: How Many Successes Would We Keep?', fontweight='bold')
    ax1.grid(True, alpha=0.3)
    ax1.set_ylim(0, 105)
    
    # Add annotations for key timeouts
    key_timeouts = [5, 10, 15, 20]
    for timeout in key_timeouts:
        if timeout in timeout_analysis_df['timeout_s'].values:
            row = timeout_analysis_df[timeout_analysis_df['timeout_s'] == timeout].iloc[0]
            retention = row['retention_rate'] * 100
            excluded = row['excluded_successes']
            
            ax1.annotate(f'{timeout}s: {retention:.1f}%\n(-{excluded:,} successes)', 
                        xy=(timeout, retention), xytext=(timeout + 2, retention - 10),
                        arrowprops=dict(arrowstyle='->', color='red', alpha=0.7),
                        fontsize=9, ha='left',
                        bbox=dict(boxstyle='round,pad=0.3', facecolor='white', alpha=0.8))
    
    # Plot 2: Average response time vs timeout
    ax2.plot(timeout_analysis_df['timeout_s'], timeout_analysis_df['avg_time_s'], 
             marker='s', linewidth=2, markersize=5, color='blue', label='Average Time')
    ax2.plot(timeout_analysis_df['timeout_s'], timeout_analysis_df['p95_time_s'], 
             marker='^', linewidth=2, markersize=5, color='orange', label='P95 Time')
    
    ax2.set_xlabel('Timeout Threshold (seconds)')
    ax2.set_ylabel('Response Time (seconds)')
    ax2.set_title('Average Response Time of Retained Requests vs Timeout', fontweight='bold')
    ax2.legend()
    ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    # Save the plot
    output_file = output_dir / 'timeout_optimization_analysis.png'
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"Saved timeout optimization analysis: {output_file}")
    
    # plt.show()  # Disabled for batch processing

def create_speed_vs_coverage_plot(timeout_analysis_df, output_dir):
    """Create a scatter plot showing speed vs coverage trade-off."""
    
    plt.figure(figsize=(10, 8))
    
    # Create scatter plot with timeout as color
    scatter = plt.scatter(timeout_analysis_df['avg_time_s'], 
                         timeout_analysis_df['retention_rate'] * 100,
                         c=timeout_analysis_df['timeout_s'], 
                         s=100, 
                         cmap='viridis', 
                         alpha=0.7,
                         edgecolors='black')
    
    # Add colorbar
    cbar = plt.colorbar(scatter)
    cbar.set_label('Timeout Threshold (seconds)')
    
    # Add annotations for key points
    for idx, row in timeout_analysis_df.iterrows():
        if row['timeout_s'] in [5, 10, 15, 20]:
            plt.annotate(f"{row['timeout_s']}s", 
                        xy=(row['avg_time_s'], row['retention_rate'] * 100),
                        xytext=(5, 5), textcoords='offset points',
                        fontsize=9, fontweight='bold')
    
    plt.xlabel('Average Response Time of Retained Requests (seconds)')
    plt.ylabel('Success Retention Rate (%)')
    plt.title('Speed vs Coverage Trade-off: Pareto Frontier of Timeout Settings', fontweight='bold')
    plt.grid(True, alpha=0.3)
    
    # Add some guidance lines
    plt.axhline(y=90, color='red', linestyle='--', alpha=0.5, label='90% retention')
    plt.axhline(y=95, color='orange', linestyle='--', alpha=0.5, label='95% retention')
    plt.legend()
    
    plt.tight_layout()
    
    # Save the plot
    output_file = output_dir / 'speed_vs_coverage_tradeoff.png'
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"Saved speed vs coverage trade-off analysis: {output_file}")
    
    # plt.show()  # Disabled for batch processing

def generate_timeout_recommendations(timeout_analysis_df):
    """Generate recommendations for optimal timeout settings."""
    
    print("\n=== TIMEOUT OPTIMIZATION RECOMMENDATIONS ===")
    
    # Find timeout that retains 90%, 95%, 99% of successes
    retention_targets = [0.90, 0.95, 0.99]
    
    for target in retention_targets:
        # Find the lowest timeout that achieves this retention rate
        candidates = timeout_analysis_df[timeout_analysis_df['retention_rate'] >= target]
        
        if len(candidates) > 0:
            optimal = candidates.iloc[0]  # First (lowest timeout) that meets criteria
            excluded = optimal['excluded_successes']
            speed_gain = (timeout_analysis_df['avg_time_s'].iloc[-1] - optimal['avg_time_s']) / timeout_analysis_df['avg_time_s'].iloc[-1] * 100
            
            print(f"\n📊 To retain {target*100:.0f}% of successful downloads:")
            print(f"   Optimal timeout: {optimal['timeout_s']:.1f}s")
            print(f"   Average response time: {optimal['avg_time_s']:.2f}s")
            print(f"   Excluded successes: {excluded:,}")
            print(f"   Speed improvement vs no timeout: {speed_gain:.1f}%")
        else:
            print(f"\n⚠️  Cannot achieve {target*100:.0f}% retention with tested timeouts")
    
    # Find the "knee" of the curve (biggest improvement for smallest loss)
    timeout_analysis_df['marginal_exclusion'] = timeout_analysis_df['exclusion_rate'].diff()
    timeout_analysis_df['marginal_speed_gain'] = -timeout_analysis_df['avg_time_s'].diff()
    
    # Calculate efficiency ratio (speed gain per percent of successes lost)
    timeout_analysis_df['efficiency_ratio'] = (
        timeout_analysis_df['marginal_speed_gain'] / 
        (timeout_analysis_df['marginal_exclusion'] + 0.001)  # Avoid division by zero
    )
    
    # Find most efficient timeout (best speed gain per success lost)
    most_efficient_idx = timeout_analysis_df['efficiency_ratio'].idxmax()
    if pd.notna(most_efficient_idx):
        optimal_row = timeout_analysis_df.loc[most_efficient_idx]
        print(f"\n🎯 MOST EFFICIENT TIMEOUT:")
        print(f"   Timeout: {optimal_row['timeout_s']:.1f}s")
        print(f"   Retains: {optimal_row['retention_rate']*100:.1f}% of successes")
        print(f"   Average time: {optimal_row['avg_time_s']:.2f}s")
        print(f"   Efficiency ratio: {optimal_row['efficiency_ratio']:.2f}")

def main():
    parser = argparse.ArgumentParser(description='Analyze download timing and timeout optimization')
    parser.add_argument('csv_file', help='CSV file from download test results')
    parser.add_argument('-o', '--output', help='Output directory for charts (default: same as input file)')
    parser.add_argument('--max-timeout', type=float, default=30, help='Maximum timeout to analyze (default: 30s)')
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
    df, successful_df, failed_df = load_and_prepare_timing_data(args.csv_file, args.include_invalid_urls)
    
    # Apply sampling if requested
    if args.sample and args.sample < len(df):
        if args.random:
            df = df.sample(n=args.sample, random_state=42)
            successful_df = df[df['final_success'] == True]
            failed_df = df[df['final_success'] == False]
            print(f"Selected random sample of {args.sample:,} records")
        else:
            df = df.head(args.sample)
            successful_df = df[df['final_success'] == True]
            failed_df = df[df['final_success'] == False]
            print(f"Selected first {args.sample:,} records")
    
    # Create timeout thresholds up to max_timeout
    timeout_thresholds = np.concatenate([
        np.arange(0.5, 5, 0.5),     # 0.5s to 5s in 0.5s steps
        np.arange(5, args.max_timeout + 1, 1)    # 5s to max in 1s steps
    ])
    
    timeout_analysis_df = analyze_timeout_impact(successful_df, timeout_thresholds)
    
    if len(timeout_analysis_df) == 0:
        print("Error: No timing data available for analysis")
        return
    
    # Generate visualizations
    create_timing_distribution_plot(successful_df, failed_df, output_dir)
    create_timeout_optimization_plot(timeout_analysis_df, output_dir)
    create_speed_vs_coverage_plot(timeout_analysis_df, output_dir)
    
    # Generate recommendations
    generate_timeout_recommendations(timeout_analysis_df)
    
    # Save detailed results
    output_csv = output_dir / 'timeout_analysis_results.csv'
    timeout_analysis_df.to_csv(output_csv, index=False)
    print(f"\nSaved detailed timeout analysis: {output_csv}")

if __name__ == '__main__':
    main()