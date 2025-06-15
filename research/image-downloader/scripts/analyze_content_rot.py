#!/usr/bin/env python
"""
Analyze content rot (link decay) patterns over time.

This script analyzes how web content availability degrades over time,
using search_result_id as a proxy for content age, and comparing
original success rates with current test results.
"""

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import argparse
from pathlib import Path
from scipy import stats
from datetime import datetime, timedelta

def load_and_prepare_rot_data(csv_file, include_invalid_urls=False):
    """Load test results and prepare for content rot analysis."""
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
    
    # Convert search_result_id to numeric (our age proxy)
    df['search_result_id'] = pd.to_numeric(df['search_result_id'])
    
    # Create age percentiles as a more interpretable measure
    df['age_percentile'] = pd.qcut(df['search_result_id'], 
                                  q=100, labels=False, duplicates='drop')
    
    # Create age buckets for analysis
    df['age_bucket'] = pd.qcut(df['search_result_id'], 
                              q=20, labels=False, duplicates='drop')
    
    # Map original states to success/failure
    df['originally_successful'] = df['original_state'] == 'SUCCESS'
    df['originally_failed'] = df['original_state'] == 'FAILURE'
    
    # Calculate degradation for originally successful content
    df['degraded'] = (df['originally_successful'] & (~df['final_success']))
    
    print(f"Loaded {len(df):,} records")
    print(f"ID range: {df['search_result_id'].min():,} to {df['search_result_id'].max():,}")
    print(f"Originally successful: {df['originally_successful'].sum():,}")
    print(f"Originally failed: {df['originally_failed'].sum():,}")
    print(f"Degraded (was successful, now failed): {df['degraded'].sum():,}")
    
    return df

def calculate_rot_rates_by_age(df):
    """Calculate various rot metrics by age bucket."""
    
    rot_analysis = []
    
    for bucket in sorted(df['age_bucket'].unique()):
        bucket_data = df[df['age_bucket'] == bucket]
        
        if len(bucket_data) == 0:
            continue
            
        # Basic stats
        total_in_bucket = len(bucket_data)
        min_id = bucket_data['search_result_id'].min()
        max_id = bucket_data['search_result_id'].max()
        median_id = bucket_data['search_result_id'].median()
        
        # Original success rate (historical baseline)
        originally_successful_count = bucket_data['originally_successful'].sum()
        original_success_rate = originally_successful_count / total_in_bucket
        
        # Current success rate
        currently_successful_count = bucket_data['final_success'].sum()
        current_success_rate = currently_successful_count / total_in_bucket
        
        # Degradation rate (of originally successful content)
        if originally_successful_count > 0:
            degraded_count = bucket_data['degraded'].sum()
            degradation_rate = degraded_count / originally_successful_count
        else:
            degraded_count = 0
            degradation_rate = 0
        
        # Success retention rate
        retention_rate = current_success_rate / original_success_rate if original_success_rate > 0 else 0
        
        # Failure stage analysis for degraded content
        degraded_data = bucket_data[bucket_data['degraded']]
        failure_stages = {}
        if len(degraded_data) > 0:
            stage_counts = degraded_data['failure_stage'].value_counts()
            for stage, count in stage_counts.items():
                failure_stages[stage] = count / len(degraded_data)
        
        rot_analysis.append({
            'age_bucket': bucket,
            'min_id': min_id,
            'max_id': max_id,
            'median_id': median_id,
            'total_records': total_in_bucket,
            'original_success_count': originally_successful_count,
            'original_success_rate': original_success_rate,
            'current_success_count': currently_successful_count,
            'current_success_rate': current_success_rate,
            'degraded_count': degraded_count,
            'degradation_rate': degradation_rate,
            'retention_rate': retention_rate,
            'rot_rate': 1 - retention_rate,
            **{f'degraded_failure_{stage}': rate for stage, rate in failure_stages.items()}
        })
    
    return pd.DataFrame(rot_analysis)

def create_rot_overview_plot(rot_df, output_dir):
    """Create overview plots showing content rot patterns."""
    
    fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 12))
    
    # Plot 1: Original vs Current Success Rates
    x_labels = [f"{int(row['min_id']//1000)}K-{int(row['max_id']//1000)}K" 
               for _, row in rot_df.iterrows()]
    
    width = 0.35
    x = np.arange(len(x_labels))
    
    bars1 = ax1.bar(x - width/2, rot_df['original_success_rate'] * 100, width, 
                   label='Original Success Rate', color='lightblue', alpha=0.8)
    bars2 = ax1.bar(x + width/2, rot_df['current_success_rate'] * 100, width,
                   label='Current Success Rate', color='darkblue', alpha=0.8)
    
    ax1.set_xlabel('Content Age (by Search Result ID Range)')
    ax1.set_ylabel('Success Rate (%)')
    ax1.set_title('Content Availability: Original vs Current', fontweight='bold')
    ax1.set_xticks(x)
    ax1.set_xticklabels(x_labels, rotation=45, ha='right')
    ax1.legend()
    ax1.grid(True, alpha=0.3)
    
    # Plot 2: Degradation Rate by Age
    ax2.plot(range(len(rot_df)), rot_df['degradation_rate'] * 100, 
            marker='o', linewidth=3, markersize=6, color='red')
    ax2.set_xlabel('Age Bucket (0=Newest, 19=Oldest)')
    ax2.set_ylabel('Degradation Rate (%)')
    ax2.set_title('Content Degradation Rate by Age\n(% of originally successful content now failed)', fontweight='bold')
    ax2.grid(True, alpha=0.3)
    
    # Add trend line
    z = np.polyfit(range(len(rot_df)), rot_df['degradation_rate'] * 100, 1)
    p = np.poly1d(z)
    ax2.plot(range(len(rot_df)), p(range(len(rot_df))), 
            linestyle='--', color='darkred', alpha=0.7,
            label=f'Trend: {z[0]:.2f}% increase per age bucket')
    ax2.legend()
    
    # Plot 3: Retention Rate by Age
    ax3.plot(range(len(rot_df)), rot_df['retention_rate'] * 100,
            marker='s', linewidth=3, markersize=6, color='green')
    ax3.set_xlabel('Age Bucket (0=Newest, 19=Oldest)')
    ax3.set_ylabel('Retention Rate (%)')
    ax3.set_title('Content Retention Rate by Age\n(Current success rate / Original success rate)', fontweight='bold')
    ax3.grid(True, alpha=0.3)
    ax3.set_ylim(0, 105)
    
    # Add 50% line (half-life reference)
    ax3.axhline(y=50, color='red', linestyle='--', alpha=0.5, label='50% Retention')
    ax3.legend()
    
    # Plot 4: Absolute numbers
    ax4.bar(range(len(rot_df)), rot_df['degraded_count'], 
           color='orange', alpha=0.7)
    ax4.set_xlabel('Age Bucket (0=Newest, 19=Oldest)')
    ax4.set_ylabel('Number of Degraded Links')
    ax4.set_title('Absolute Count of Degraded Content by Age', fontweight='bold')
    ax4.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    # Save the plot
    output_file = output_dir / 'content_rot_overview.png'
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"Saved content rot overview: {output_file}")
    
    # plt.show()  # Disabled for batch processing

def create_failure_mode_by_age_plot(df, rot_df, output_dir):
    """Create plot showing how failure modes change with content age."""
    
    # Analyze failure stages by age for degraded content
    degraded_data = df[df['degraded']]
    
    if len(degraded_data) == 0:
        print("No degraded content found for failure mode analysis")
        return
    
    # Create failure stage breakdown by age bucket
    failure_stage_by_age = []
    
    for bucket in sorted(degraded_data['age_bucket'].unique()):
        bucket_degraded = degraded_data[degraded_data['age_bucket'] == bucket]
        
        if len(bucket_degraded) == 0:
            continue
            
        stage_counts = bucket_degraded['failure_stage'].value_counts(normalize=True)
        
        for stage, proportion in stage_counts.items():
            failure_stage_by_age.append({
                'age_bucket': bucket,
                'failure_stage': stage,
                'proportion': proportion
            })
    
    failure_df = pd.DataFrame(failure_stage_by_age)
    
    if len(failure_df) == 0:
        print("Insufficient failure stage data for analysis")
        return
    
    # Create stacked bar chart
    plt.figure(figsize=(14, 8))
    
    # Pivot for stacked bar chart
    pivot_df = failure_df.pivot(index='age_bucket', columns='failure_stage', values='proportion')
    pivot_df = pivot_df.fillna(0)
    
    # Create stacked bar chart
    pivot_df.plot(kind='bar', stacked=True, 
                 colormap='Set3', figsize=(14, 8))
    
    plt.xlabel('Age Bucket (0=Newest, 19=Oldest)')
    plt.ylabel('Proportion of Degraded Content')
    plt.title('Failure Mode Breakdown by Content Age\n(For originally successful content that now fails)', 
              fontweight='bold')
    plt.legend(title='Failure Stage', bbox_to_anchor=(1.05, 1), loc='upper left')
    plt.xticks(rotation=0)
    plt.grid(True, alpha=0.3, axis='y')
    
    plt.tight_layout()
    
    # Save the plot
    output_file = output_dir / 'failure_modes_by_age.png'
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"Saved failure modes by age analysis: {output_file}")
    
    # plt.show()  # Disabled for batch processing

def create_half_life_analysis(rot_df, output_dir):
    """Analyze and visualize content 'half-life' patterns."""
    
    plt.figure(figsize=(12, 8))
    
    # Plot retention rate vs age bucket
    x = rot_df.index
    y = rot_df['retention_rate'] * 100
    
    plt.plot(x, y, marker='o', linewidth=3, markersize=8, color='blue', label='Observed Retention Rate')
    
    # Fit exponential decay model
    try:
        # Exponential decay: y = a * exp(-b * x)
        def exp_decay(x, a, b):
            return a * np.exp(-b * x)
        
        from scipy.optimize import curve_fit
        
        # Only fit to data points with reasonable retention rates
        valid_mask = (y > 0) & (y <= 100)
        if valid_mask.sum() > 3:  # Need at least 3 points
            popt, pcov = curve_fit(exp_decay, x[valid_mask], y[valid_mask], 
                                 p0=[100, 0.1], maxfev=2000)
            
            # Generate smooth curve
            x_smooth = np.linspace(0, len(rot_df)-1, 100)
            y_smooth = exp_decay(x_smooth, *popt)
            
            plt.plot(x_smooth, y_smooth, '--', color='red', linewidth=2, 
                    label=f'Exponential Decay Model\na={popt[0]:.1f}, b={popt[1]:.4f}')
            
            # Calculate half-life (when retention = 50%)
            if popt[0] > 50:  # Only if starting point is above 50%
                half_life_bucket = np.log(50 / popt[0]) / (-popt[1])
                if 0 <= half_life_bucket <= len(rot_df):
                    plt.axhline(y=50, color='red', linestyle=':', alpha=0.7)
                    plt.axvline(x=half_life_bucket, color='red', linestyle=':', alpha=0.7)
                    plt.text(half_life_bucket + 0.5, 55, 
                            f'Half-life: {half_life_bucket:.1f} age buckets', 
                            bbox=dict(boxstyle='round,pad=0.3', facecolor='white', alpha=0.8))
    
    except Exception as e:
        print(f"Could not fit exponential decay model: {e}")
    
    plt.xlabel('Age Bucket (0=Newest, 19=Oldest)')
    plt.ylabel('Content Retention Rate (%)')
    plt.title('Content Decay Half-Life Analysis', fontweight='bold')
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.ylim(0, 105)
    
    plt.tight_layout()
    
    # Save the plot
    output_file = output_dir / 'content_half_life_analysis.png'
    plt.savefig(output_file, dpi=300, bbox_inches='tight')
    print(f"Saved half-life analysis: {output_file}")
    
    # plt.show()  # Disabled for batch processing

def generate_rot_statistics(df, rot_df):
    """Generate comprehensive statistics about content rot."""
    
    print("\n=== CONTENT ROT ANALYSIS ===")
    
    # Overall rot statistics
    total_originally_successful = df['originally_successful'].sum()
    total_degraded = df['degraded'].sum()
    overall_degradation_rate = total_degraded / total_originally_successful if total_originally_successful > 0 else 0
    
    print(f"📊 OVERALL STATISTICS:")
    print(f"Total originally successful content: {total_originally_successful:,}")
    print(f"Content that degraded: {total_degraded:,}")
    print(f"Overall degradation rate: {overall_degradation_rate*100:.1f}%")
    
    # Age-based analysis
    newest_bucket = rot_df[rot_df.index == 0]
    oldest_bucket = rot_df[rot_df.index == len(rot_df)-1]
    
    if len(newest_bucket) > 0 and len(oldest_bucket) > 0:
        newest_degradation = newest_bucket['degradation_rate'].iloc[0] * 100
        oldest_degradation = oldest_bucket['degradation_rate'].iloc[0] * 100
        degradation_increase = oldest_degradation - newest_degradation
        
        print(f"\n📈 AGE-BASED DEGRADATION:")
        print(f"Newest content degradation rate: {newest_degradation:.1f}%")
        print(f"Oldest content degradation rate: {oldest_degradation:.1f}%")
        print(f"Degradation increase from newest to oldest: {degradation_increase:.1f} percentage points")
        
        # Calculate relative risk
        if newest_degradation > 0:
            relative_risk = oldest_degradation / newest_degradation
            print(f"Oldest content is {relative_risk:.1f}x more likely to be degraded")
    
    # Failure mode analysis
    degraded_data = df[df['degraded']]
    if len(degraded_data) > 0:
        failure_modes = degraded_data['failure_stage'].value_counts()
        print(f"\n🚫 TOP DEGRADATION FAILURE MODES:")
        for stage, count in failure_modes.head(5).items():
            percentage = count / len(degraded_data) * 100
            print(f"  {stage}: {count:,} ({percentage:.1f}%)")
    
    # Domain analysis for degraded content
    if 'domain' in degraded_data.columns:
        degraded_domains = degraded_data['domain'].value_counts()
        print(f"\n🌐 TOP DOMAINS WITH DEGRADED CONTENT:")
        for domain, count in degraded_domains.head(5).items():
            percentage = count / len(degraded_data) * 100
            print(f"  {domain}: {count:,} ({percentage:.1f}%)")
    
    # Statistical significance test
    if len(rot_df) > 2:
        # Test correlation between age and degradation rate
        age_proxy = range(len(rot_df))
        degradation_rates = rot_df['degradation_rate']
        
        correlation, p_value = stats.pearsonr(age_proxy, degradation_rates)
        print(f"\n📊 STATISTICAL ANALYSIS:")
        print(f"Correlation between age and degradation: {correlation:.3f}")
        print(f"P-value: {p_value:.6f}")
        
        if p_value < 0.05:
            print("✅ Statistically significant correlation between age and degradation")
        else:
            print("❌ No statistically significant correlation found")

def main():
    parser = argparse.ArgumentParser(description='Analyze content rot (link decay) patterns')
    parser.add_argument('csv_file', help='CSV file from download test results')
    parser.add_argument('-o', '--output', help='Output directory for charts (default: same as input file)')
    parser.add_argument('--age-buckets', type=int, default=20, help='Number of age buckets (default: 20)')
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
    df = load_and_prepare_rot_data(args.csv_file, args.include_invalid_urls)
    
    # Apply sampling if requested
    if args.sample and args.sample < len(df):
        if args.random:
            df = df.sample(n=args.sample, random_state=42)
            print(f"Selected random sample of {args.sample:,} records")
        else:
            df = df.head(args.sample)
            print(f"Selected first {args.sample:,} records")
    rot_df = calculate_rot_rates_by_age(df)
    
    if len(rot_df) == 0:
        print("Error: No age bucket data available for analysis")
        return
    
    # Generate visualizations
    create_rot_overview_plot(rot_df, output_dir)
    create_failure_mode_by_age_plot(df, rot_df, output_dir)
    create_half_life_analysis(rot_df, output_dir)
    
    # Generate statistics
    generate_rot_statistics(df, rot_df)
    
    # Save detailed results
    output_csv = output_dir / 'content_rot_analysis.csv'
    rot_df.to_csv(output_csv, index=False)
    print(f"\nSaved detailed rot analysis: {output_csv}")

if __name__ == '__main__':
    main()