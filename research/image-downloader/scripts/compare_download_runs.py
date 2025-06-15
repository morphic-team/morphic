#!/usr/bin/env python
"""
Compare multiple download test runs to analyze uplift and falloff patterns.

This script analyzes the effectiveness of different download strategies by comparing
results across multiple test runs, calculating rescue rates, failure regression,
and ROI metrics for strategy optimization.
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import argparse
from pathlib import Path
from datetime import datetime
import json

class DownloadRunComparator:
    """Compare multiple download test runs to analyze strategy effectiveness."""
    
    def __init__(self):
        self.runs = {}
        self.comparison_results = {}
        
        # Define failure stages that are NOT rescuable by client-side strategies
        self.non_rescuable_stages = {
            'dns',           # DNS resolution failures - server/network issue
            'invalid_url',   # Malformed URLs - data quality issue
            # Note: We keep all other stages as potentially rescuable:
            # - http_status: Anti-bot measures, can be bypassed with headers/retry
            # - tcp_connection: Network timeouts, can be rescued with retry
            # - ssl_handshake: SSL issues, can be rescued with different approaches
            # - http_timeout: Request timeouts, can be rescued with retry/different params
            # - http_request: Generic request failures, can be rescued with retry
        }
        
    def load_run(self, csv_file, run_name, include_invalid_urls=False):
        """Load a download test run result."""
        print(f"Loading {run_name} from {csv_file}")
        df = pd.read_csv(csv_file)
        
        # Ensure we have the required columns
        required_cols = ['search_result_id', 'final_success', 'strategy']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Missing required columns in {csv_file}: {missing_cols}")
        
        # Expect valid_url column to exist
        if 'valid_url' not in df.columns:
            raise ValueError(f"Missing 'valid_url' column in {csv_file}. Please reprocess your data with reprocess_invalid_urls.py first.")
        
        # Convert string values to boolean if needed
        if df['valid_url'].dtype == 'object':
            df['valid_url'] = df['valid_url'].astype(str).str.lower() == 'true'
        
        # Filter invalid URLs if requested
        original_count = len(df)
        invalid_count = (~df['valid_url']).sum()
        if invalid_count > 0:
            print(f"  Found {invalid_count:,} invalid URLs ({invalid_count/original_count*100:.1f}%)")
            
            if not include_invalid_urls:
                print(f"  Excluding invalid URLs from comparison (use --include-invalid-urls to include)")
                df = df[df['valid_url']].copy()
                print(f"  Using {len(df):,} records with valid URLs")
        
        # Store run info
        self.runs[run_name] = {
            'data': df,
            'total_records': len(df),
            'original_records': original_count,
            'invalid_urls': invalid_count,
            'success_rate': df['final_success'].mean(),
            'strategy': df['strategy'].iloc[0] if 'strategy' in df.columns else 'unknown',
            'file_path': csv_file
        }
        
        print(f"  {len(df):,} records, {df['final_success'].sum():,} successful ({df['final_success'].mean()*100:.1f}%)")
        return df
    
    def compare_runs(self, run1_name, run2_name):
        """Compare two runs and calculate uplift/falloff metrics."""
        if run1_name not in self.runs or run2_name not in self.runs:
            raise ValueError(f"Both runs must be loaded first: {run1_name}, {run2_name}")
        
        run1_df = self.runs[run1_name]['data']
        run2_df = self.runs[run2_name]['data']
        
        print(f"\n=== COMPARING {run1_name} → {run2_name} ===")
        
        # Merge on search_result_id to get matched URLs
        merged = pd.merge(
            run1_df[['search_result_id', 'final_success', 'failure_stage', 'error_type', 'domain']],
            run2_df[['search_result_id', 'final_success', 'failure_stage', 'error_type', 'total_download_time_ms']],
            on='search_result_id', 
            suffixes=('_run1', '_run2'),
            how='inner'
        )
        
        if len(merged) == 0:
            print("❌ No matching search_result_ids found between runs!")
            return None
        
        # Detailed overlap reporting
        run1_total = len(run1_df)
        run2_total = len(run2_df)
        matched_count = len(merged)
        
        print(f"📊 DATASET OVERLAP ANALYSIS:")
        print(f"  {run1_name} total URLs: {run1_total:,}")
        print(f"  {run2_name} total URLs: {run2_total:,}")
        print(f"  Matched URLs: {matched_count:,}")
        print(f"  Overlap with {run1_name}: {matched_count/run1_total*100:.1f}% ({run1_total-matched_count:,} missing)")
        print(f"  Overlap with {run2_name}: {matched_count/run2_total*100:.1f}% ({run2_total-matched_count:,} missing)")
        
        # Warn if overlap is low
        min_overlap = min(matched_count/run1_total, matched_count/run2_total)
        if min_overlap < 0.8:
            print(f"⚠️  WARNING: Low overlap ({min_overlap*100:.1f}%) - results may not be representative!")
        elif min_overlap < 0.95:
            print(f"⚠️  CAUTION: Some URLs missing ({min_overlap*100:.1f}% overlap)")
        else:
            print(f"✅ Good overlap ({min_overlap*100:.1f}%) - results should be representative")
        
        # Calculate transition matrix
        transitions = {
            'stable_success': ((merged['final_success_run1'] == True) & (merged['final_success_run2'] == True)).sum(),
            'stable_failure': ((merged['final_success_run1'] == False) & (merged['final_success_run2'] == False)).sum(),
            'falloff': ((merged['final_success_run1'] == True) & (merged['final_success_run2'] == False)).sum(),
            'uplift': ((merged['final_success_run1'] == False) & (merged['final_success_run2'] == True)).sum()
        }
        
        total_matched = len(merged)
        
        # Calculate rates
        run1_success = merged['final_success_run1'].sum()
        run2_success = merged['final_success_run2'].sum()
        
        analysis = {
            'run1_name': run1_name,
            'run2_name': run2_name,
            'matched_urls': total_matched,
            'run1_strategy': self.runs[run1_name]['strategy'],
            'run2_strategy': self.runs[run2_name]['strategy'],
            
            # Transition counts
            'stable_success': transitions['stable_success'],
            'stable_failure': transitions['stable_failure'],  
            'falloff_count': transitions['falloff'],
            'uplift_count': transitions['uplift'],
            
            # Success rates
            'run1_success_rate': run1_success / total_matched,
            'run2_success_rate': run2_success / total_matched,
            
            # Key metrics
            'net_improvement': transitions['uplift'] - transitions['falloff'],
            'uplift_rate': transitions['uplift'] / total_matched,
            'falloff_rate': transitions['falloff'] / total_matched,
            'net_improvement_rate': (transitions['uplift'] - transitions['falloff']) / total_matched,
            
            # Conditional rates
            'rescue_rate': transitions['uplift'] / (merged['final_success_run1'] == False).sum() if (merged['final_success_run1'] == False).sum() > 0 else 0,
            'regression_rate': transitions['falloff'] / (merged['final_success_run1'] == True).sum() if (merged['final_success_run1'] == True).sum() > 0 else 0,
            
            'merged_data': merged
        }
        
        # Store comparison result
        comparison_key = f"{run1_name}_vs_{run2_name}"
        self.comparison_results[comparison_key] = analysis
        
        return analysis
    
    def analyze_rescuable_urls(self, comparison_key, output_dir):
        """Analyze comparison focusing only on URLs where expensive strategy could theoretically help."""
        if comparison_key not in self.comparison_results:
            raise ValueError(f"Comparison '{comparison_key}' not found. Run compare_runs() first.")
        
        analysis = self.comparison_results[comparison_key]
        merged = analysis['merged_data']
        
        # Filter to only rescuable URLs (exclude DNS failures, invalid URLs, etc.)
        rescuable_mask = ~merged['failure_stage_run1'].isin(self.non_rescuable_stages)
        rescuable_merged = merged[rescuable_mask]
        
        if len(rescuable_merged) == 0:
            print("\n=== RESCUABLE URLS ANALYSIS ===")
            print("No rescuable URLs found (all failures were DNS/invalid URL)")
            return {}
        
        # Calculate rescuable transitions
        rescuable_transitions = {
            'stable_success': ((rescuable_merged['final_success_run1'] == True) & (rescuable_merged['final_success_run2'] == True)).sum(),
            'stable_failure': ((rescuable_merged['final_success_run1'] == False) & (rescuable_merged['final_success_run2'] == False)).sum(),
            'falloff': ((rescuable_merged['final_success_run1'] == True) & (rescuable_merged['final_success_run2'] == False)).sum(),
            'uplift': ((rescuable_merged['final_success_run1'] == False) & (rescuable_merged['final_success_run2'] == True)).sum()
        }
        
        total_rescuable = len(rescuable_merged)
        rescuable_run1_success = rescuable_merged['final_success_run1'].sum()
        rescuable_run2_success = rescuable_merged['final_success_run2'].sum()
        rescuable_run1_failures = total_rescuable - rescuable_run1_success
        
        print(f"\n=== RESCUABLE URLS ANALYSIS ===")
        print(f"Total URLs analyzed: {len(merged):,}")
        print(f"Rescuable URLs (excluding DNS/invalid): {total_rescuable:,} ({total_rescuable/len(merged)*100:.1f}%)")
        print(f"Non-rescuable failures excluded: {len(merged) - total_rescuable:,}")
        
        print(f"\nRescuable URL Results:")
        print(f"  {analysis['run1_name']}: {rescuable_run1_success:,}/{total_rescuable:,} ({rescuable_run1_success/total_rescuable*100:.1f}%)")
        print(f"  {analysis['run2_name']}: {rescuable_run2_success:,}/{total_rescuable:,} ({rescuable_run2_success/total_rescuable*100:.1f}%)")
        
        net_rescuable_improvement = rescuable_transitions['uplift'] - rescuable_transitions['falloff']
        rescuable_improvement_rate = net_rescuable_improvement / total_rescuable * 100
        rescuable_rescue_rate = rescuable_transitions['uplift'] / rescuable_run1_failures * 100 if rescuable_run1_failures > 0 else 0
        
        print(f"\nRescuable URL Performance:")
        print(f"  URLs rescued: {rescuable_transitions['uplift']:,}")
        print(f"  URLs regressed: {rescuable_transitions['falloff']:,}")
        print(f"  Net improvement: {net_rescuable_improvement:,} URLs ({rescuable_improvement_rate:+.1f}%)")
        print(f"  Rescue rate: {rescuable_rescue_rate:.1f}% of failed rescuable URLs")
        
        # Show what types of failures were excluded
        excluded_failures = merged[~rescuable_mask]['failure_stage_run1'].value_counts()
        if len(excluded_failures) > 0:
            print(f"\nExcluded non-rescuable failure types:")
            for stage, count in excluded_failures.items():
                print(f"  {stage}: {count:,} URLs")
        
        rescuable_analysis = {
            'total_rescuable': total_rescuable,
            'rescuable_run1_success': rescuable_run1_success,
            'rescuable_run2_success': rescuable_run2_success,
            'rescuable_net_improvement': net_rescuable_improvement,
            'rescuable_improvement_rate': rescuable_improvement_rate,
            'rescuable_rescue_rate': rescuable_rescue_rate,
            'excluded_failures': excluded_failures.to_dict() if len(excluded_failures) > 0 else {},
            'rescuable_data': rescuable_merged
        }
        
        # Generate rescuable analysis visualization
        self._generate_rescuable_visualization(comparison_key, rescuable_analysis, output_dir)
        
        return rescuable_analysis
    
    def analyze_uplift_patterns(self, comparison_key):
        """Analyze patterns in uplifted (rescued) URLs."""
        if comparison_key not in self.comparison_results:
            raise ValueError(f"Comparison {comparison_key} not found")
        
        analysis = self.comparison_results[comparison_key]
        merged = analysis['merged_data']
        
        # Focus on uplifted URLs (run1 failed, run2 succeeded)
        uplifted = merged[(merged['final_success_run1'] == False) & (merged['final_success_run2'] == True)]
        
        if len(uplifted) == 0:
            print("No uplifted URLs found for pattern analysis")
            return {}
        
        print(f"\n=== UPLIFT PATTERN ANALYSIS ({len(uplifted):,} rescued URLs) ===")
        
        patterns = {}
        
        # 1. Uplift by original failure stage
        if 'failure_stage_run1' in uplifted.columns:
            failure_stage_uplift = uplifted['failure_stage_run1'].value_counts()
            patterns['by_failure_stage'] = failure_stage_uplift.to_dict()
            
            print("Uplift by original failure stage:")
            for stage, count in failure_stage_uplift.head(10).items():
                total_failures = merged[merged['failure_stage_run1'] == stage].shape[0]
                rescue_rate = count / total_failures if total_failures > 0 else 0
                print(f"  {stage}: {count:,} rescued / {total_failures:,} total ({rescue_rate*100:.1f}% rescue rate)")
        
        # 2. Uplift by domain
        if 'domain' in uplifted.columns:
            domain_uplift = uplifted['domain'].value_counts()
            patterns['by_domain'] = domain_uplift.head(20).to_dict()
            
            print(f"\nTop domains with rescued URLs:")
            for domain, count in domain_uplift.head(10).items():
                total_domain_failures = merged[(merged['domain'] == domain) & (merged['final_success_run1'] == False)].shape[0]
                rescue_rate = count / total_domain_failures if total_domain_failures > 0 else 0
                print(f"  {domain}: {count:,} rescued / {total_domain_failures:,} failed ({rescue_rate*100:.1f}% rescue rate)")
        
        # 3. Uplift by error type
        if 'error_type_run1' in uplifted.columns:
            error_type_uplift = uplifted['error_type_run1'].value_counts()
            patterns['by_error_type'] = error_type_uplift.head(15).to_dict()
            
            print(f"\nTop error types rescued:")
            for error_type, count in error_type_uplift.head(10).items():
                if pd.isna(error_type):
                    continue
                total_error_failures = merged[(merged['error_type_run1'] == error_type) & (merged['final_success_run1'] == False)].shape[0]
                rescue_rate = count / total_error_failures if total_error_failures > 0 else 0
                print(f"  {error_type}: {count:,} rescued / {total_error_failures:,} total ({rescue_rate*100:.1f}% rescue rate)")
        
        # 4. Time investment analysis
        if 'total_download_time_ms_run2' in uplifted.columns:
            time_stats = uplifted['total_download_time_ms_run2'].describe()
            patterns['time_investment'] = {
                'mean_time_ms': time_stats['mean'],
                'median_time_ms': time_stats['50%'],
                'p95_time_ms': time_stats['95%'] if '95%' in time_stats else None,
                'total_time_hours': uplifted['total_download_time_ms_run2'].sum() / (1000 * 60 * 60)
            }
            
            print(f"\nTime investment for rescued URLs:")
            print(f"  Mean time: {time_stats['mean']:.1f}ms")
            print(f"  Median time: {time_stats['50%']:.1f}ms")
            print(f"  Total time: {patterns['time_investment']['total_time_hours']:.2f} hours")
        
        return patterns
    
    def analyze_falloff_patterns(self, comparison_key):
        """Analyze patterns in regressed URLs (falloff)."""
        if comparison_key not in self.comparison_results:
            raise ValueError(f"Comparison {comparison_key} not found")
        
        analysis = self.comparison_results[comparison_key]
        merged = analysis['merged_data']
        
        # Focus on regressed URLs (run1 succeeded, run2 failed)
        regressed = merged[(merged['final_success_run1'] == True) & (merged['final_success_run2'] == False)]
        
        if len(regressed) == 0:
            print("No regressed URLs found for pattern analysis")
            return {}
        
        print(f"\n=== FALLOFF PATTERN ANALYSIS ({len(regressed):,} regressed URLs) ===")
        
        patterns = {}
        
        # 1. Falloff by new failure stage
        if 'failure_stage_run2' in regressed.columns:
            failure_stage_falloff = regressed['failure_stage_run2'].value_counts()
            patterns['by_failure_stage'] = failure_stage_falloff.to_dict()
            
            print("Falloff by new failure stage:")
            for stage, count in failure_stage_falloff.head(10).items():
                print(f"  {stage}: {count:,}")
        
        # 2. Falloff by domain
        if 'domain' in regressed.columns:
            domain_falloff = regressed['domain'].value_counts()
            patterns['by_domain'] = domain_falloff.head(20).to_dict()
            
            print(f"\nTop domains with regressed URLs:")
            for domain, count in domain_falloff.head(10).items():
                total_domain_success = merged[(merged['domain'] == domain) & (merged['final_success_run1'] == True)].shape[0]
                regression_rate = count / total_domain_success if total_domain_success > 0 else 0
                print(f"  {domain}: {count:,} regressed / {total_domain_success:,} successful ({regression_rate*100:.1f}% regression rate)")
        
        return patterns
    
    def generate_comparison_matrix(self):
        """Generate a matrix showing all pairwise comparisons."""
        if len(self.comparison_results) == 0:
            print("No comparisons available")
            return None
        
        print(f"\n=== COMPARISON MATRIX ===")
        
        # Create a summary table
        summary_data = []
        for comp_key, analysis in self.comparison_results.items():
            summary_data.append({
                'Comparison': f"{analysis['run1_name']} → {analysis['run2_name']}",
                'Strategy Change': f"{analysis['run1_strategy']} → {analysis['run2_strategy']}",
                'Matched URLs': analysis['matched_urls'],
                'Run1 Success Rate': f"{analysis['run1_success_rate']*100:.1f}%",
                'Run2 Success Rate': f"{analysis['run2_success_rate']*100:.1f}%",
                'Net Improvement': analysis['net_improvement'],
                'Net Improvement %': f"{analysis['net_improvement_rate']*100:.2f}%",
                'Uplift Count': analysis['uplift_count'],
                'Rescue Rate': f"{analysis['rescue_rate']*100:.1f}%",
                'Falloff Count': analysis['falloff_count'],
                'Regression Rate': f"{analysis['regression_rate']*100:.1f}%"
            })
        
        summary_df = pd.DataFrame(summary_data)
        print(summary_df.to_string(index=False))
        
        return summary_df
    
    def _generate_rescuable_visualization(self, comparison_key, rescuable_analysis, output_dir):
        """Generate visualization comparing overall vs rescuable-only performance."""
        if comparison_key not in self.comparison_results:
            return
            
        analysis = self.comparison_results[comparison_key]
        
        # Create figure with subplots
        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 12))
        fig.suptitle(f'Rescuable URL Analysis: {analysis["run1_name"]} vs {analysis["run2_name"]}', 
                     fontsize=16, fontweight='bold')
        
        # 1. Overall vs Rescuable Success Rates Comparison
        strategies = [analysis["run1_name"], analysis["run2_name"]]
        overall_rates = [analysis["run1_success_rate"] * 100, analysis["run2_success_rate"] * 100]
        rescuable_rates = [
            rescuable_analysis["rescuable_run1_success"] / rescuable_analysis["total_rescuable"] * 100,
            rescuable_analysis["rescuable_run2_success"] / rescuable_analysis["total_rescuable"] * 100
        ]
        
        x = np.arange(len(strategies))
        width = 0.35
        
        bars1 = ax1.bar(x - width/2, overall_rates, width, label='Overall Success Rate', alpha=0.8, color='lightcoral')
        bars2 = ax1.bar(x + width/2, rescuable_rates, width, label='Rescuable URLs Only', alpha=0.8, color='lightgreen')
        
        ax1.set_ylabel('Success Rate (%)')
        ax1.set_title('Success Rates: Overall vs Rescuable URLs')
        ax1.set_xticks(x)
        ax1.set_xticklabels(strategies)
        ax1.legend()
        ax1.grid(True, alpha=0.3)
        
        # Add value labels on bars
        for bar in bars1:
            height = bar.get_height()
            ax1.text(bar.get_x() + bar.get_width()/2., height + 0.5, f'{height:.1f}%',
                    ha='center', va='bottom')
        for bar in bars2:
            height = bar.get_height()
            ax1.text(bar.get_x() + bar.get_width()/2., height + 0.5, f'{height:.1f}%',
                    ha='center', va='bottom')
        
        # 2. URL Categories Breakdown
        total_urls = analysis["matched_urls"]
        rescuable_urls = rescuable_analysis["total_rescuable"]
        non_rescuable_urls = total_urls - rescuable_urls
        
        categories = ['Rescuable URLs\n(Client strategy can help)', 'Non-rescuable URLs\n(DNS/Invalid URL failures)']
        sizes = [rescuable_urls, non_rescuable_urls]
        colors = ['lightgreen', 'lightcoral']
        
        ax2.pie(sizes, labels=categories, colors=colors, autopct='%1.1f%%', startangle=90)
        ax2.set_title(f'URL Categories\n(Total: {total_urls:,} URLs)')
        
        # 3. Excluded Failure Types
        excluded_failures = rescuable_analysis.get("excluded_failures", {})
        if excluded_failures:
            failure_types = list(excluded_failures.keys())
            failure_counts = list(excluded_failures.values())
            
            bars = ax3.bar(failure_types, failure_counts, color='lightcoral', alpha=0.7)
            ax3.set_ylabel('Number of URLs')
            ax3.set_title('Excluded Non-Rescuable Failure Types')
            ax3.tick_params(axis='x', rotation=45)
            
            # Add value labels
            for bar in bars:
                height = bar.get_height()
                ax3.text(bar.get_x() + bar.get_width()/2., height + max(failure_counts)*0.01,
                        f'{int(height):,}', ha='center', va='bottom')
        else:
            ax3.text(0.5, 0.5, 'No excluded failures', ha='center', va='center', transform=ax3.transAxes)
            ax3.set_title('Excluded Non-Rescuable Failure Types')
        
        # 4. Improvement Metrics
        overall_improvement = (analysis["run2_success_rate"] - analysis["run1_success_rate"]) * 100
        rescuable_improvement = rescuable_rates[1] - rescuable_rates[0]
        
        metrics = ['Overall\nImprovement', 'Rescuable URLs\nImprovement']
        improvements = [overall_improvement, rescuable_improvement]
        colors = ['lightblue' if imp >= 0 else 'lightcoral' for imp in improvements]
        
        bars = ax4.bar(metrics, improvements, color=colors, alpha=0.8)
        ax4.set_ylabel('Improvement (percentage points)')
        ax4.set_title('Performance Improvement Comparison')
        ax4.axhline(y=0, color='black', linestyle='-', alpha=0.3)
        ax4.grid(True, alpha=0.3)
        
        # Add value labels
        for bar in bars:
            height = bar.get_height()
            ax4.text(bar.get_x() + bar.get_width()/2., height + (0.1 if height >= 0 else -0.3),
                    f'{height:+.1f}pp', ha='center', va='bottom' if height >= 0 else 'top')
        
        plt.tight_layout()
        
        # Save the chart
        output_path = output_dir / f"rescuable_analysis_{comparison_key}.png"
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"Saved rescuable analysis visualization: {output_path}")

    def create_domain_performance_analysis(self, comparison_key, output_dir):
        """Create visualization showing which domains benefit most from advanced strategy."""
        if comparison_key not in self.comparison_results:
            return
            
        analysis = self.comparison_results[comparison_key]
        merged = analysis['merged_data']
        
        # Get uplifted URLs with domain info
        uplifted = merged[(merged['final_success_run1'] == False) & (merged['final_success_run2'] == True)]
        
        if len(uplifted) == 0:
            return
            
        # Domain analysis
        domain_rescue_counts = uplifted['domain'].value_counts().head(15)
        domain_totals = merged[merged['final_success_run1'] == False]['domain'].value_counts()
        
        # Calculate rescue rates
        domain_rescue_rates = []
        domain_names = []
        rescue_counts = []
        total_failures = []
        
        for domain in domain_rescue_counts.index:
            rescued = domain_rescue_counts[domain]
            total_failed = domain_totals.get(domain, 0)
            if total_failed > 20:  # Only include domains with meaningful sample size
                rate = (rescued / total_failed) * 100
                domain_rescue_rates.append(rate)
                domain_names.append(domain[:30])  # Truncate long domains
                rescue_counts.append(rescued)
                total_failures.append(total_failed)
        
        if len(domain_names) == 0:
            return
            
        # Create visualization
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(18, 8))
        
        # Plot 1: Rescue rates by domain
        bars1 = ax1.barh(range(len(domain_names)), domain_rescue_rates, color='lightgreen', alpha=0.8)
        ax1.set_yticks(range(len(domain_names)))
        ax1.set_yticklabels(domain_names)
        ax1.set_xlabel('Rescue Rate (%)')
        ax1.set_title(f'Domain Rescue Rates\n({analysis["run1_name"]} → {analysis["run2_name"]})')
        ax1.grid(True, alpha=0.3, axis='x')
        
        # Add value labels
        for i, (bar, rate, count, total) in enumerate(zip(bars1, domain_rescue_rates, rescue_counts, total_failures)):
            ax1.text(bar.get_width() + 1, bar.get_y() + bar.get_height()/2, 
                    f'{rate:.1f}% ({count}/{total})', 
                    va='center', fontsize=9)
        
        # Plot 2: Absolute rescue counts
        bars2 = ax2.barh(range(len(domain_names)), rescue_counts, color='lightblue', alpha=0.8)
        ax2.set_yticks(range(len(domain_names)))
        ax2.set_yticklabels(domain_names)
        ax2.set_xlabel('URLs Rescued')
        ax2.set_title('Absolute Rescue Counts by Domain')
        ax2.grid(True, alpha=0.3, axis='x')
        
        # Add value labels
        for bar, count in zip(bars2, rescue_counts):
            ax2.text(bar.get_width() + max(rescue_counts)*0.01, bar.get_y() + bar.get_height()/2, 
                    f'{count:,}', va='center', fontsize=9)
        
        plt.tight_layout()
        
        # Save
        output_path = output_dir / f'domain_performance_analysis_{comparison_key}.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"Saved domain performance analysis: {output_path}")

    def create_error_type_rescue_analysis(self, comparison_key, output_dir):
        """Create visualization of rescue effectiveness by error type."""
        if comparison_key not in self.comparison_results:
            return
            
        analysis = self.comparison_results[comparison_key]
        merged = analysis['merged_data']
        
        # Get uplifted URLs with error type info
        uplifted = merged[(merged['final_success_run1'] == False) & (merged['final_success_run2'] == True)]
        
        if len(uplifted) == 0 or 'error_type_run1' not in uplifted.columns:
            return
            
        # Error type analysis
        error_rescue_counts = uplifted['error_type_run1'].value_counts().head(12)
        error_totals = merged[merged['final_success_run1'] == False]['error_type_run1'].value_counts()
        
        # Calculate rescue rates
        error_types = []
        rescue_rates = []
        rescue_counts = []
        total_counts = []
        
        for error_type in error_rescue_counts.index:
            if pd.isna(error_type) or error_type == '':
                continue
                
            rescued = error_rescue_counts[error_type]
            total_errors = error_totals.get(error_type, 0)
            if total_errors > 10:  # Only include error types with meaningful sample size
                rate = (rescued / total_errors) * 100
                error_types.append(error_type.replace('_', ' ').title()[:25])
                rescue_rates.append(rate)
                rescue_counts.append(rescued)
                total_counts.append(total_errors)
        
        if len(error_types) == 0:
            return
            
        # Create visualization
        fig, ax = plt.subplots(figsize=(12, 8))
        
        # Color code by rescue effectiveness
        colors = ['darkgreen' if rate >= 50 else 'green' if rate >= 20 else 'orange' if rate >= 5 else 'lightcoral' 
                 for rate in rescue_rates]
        
        bars = ax.bar(range(len(error_types)), rescue_rates, color=colors, alpha=0.8)
        
        ax.set_xticks(range(len(error_types)))
        ax.set_xticklabels(error_types, rotation=45, ha='right')
        ax.set_ylabel('Rescue Rate (%)')
        ax.set_title(f'Error Type Rescue Effectiveness\n({analysis["run1_name"]} → {analysis["run2_name"]})')
        ax.grid(True, alpha=0.3, axis='y')
        
        # Add value labels
        for i, (bar, rate, rescued, total) in enumerate(zip(bars, rescue_rates, rescue_counts, total_counts)):
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1, 
                   f'{rate:.1f}%\n({rescued}/{total})', 
                   ha='center', va='bottom', fontsize=9)
        
        # Add legend
        legend_elements = [
            plt.Rectangle((0,0),1,1, color='darkgreen', alpha=0.8, label='Excellent (≥50%)'),
            plt.Rectangle((0,0),1,1, color='green', alpha=0.8, label='Good (20-49%)'),
            plt.Rectangle((0,0),1,1, color='orange', alpha=0.8, label='Moderate (5-19%)'),
            plt.Rectangle((0,0),1,1, color='lightcoral', alpha=0.8, label='Poor (<5%)')
        ]
        ax.legend(handles=legend_elements, loc='upper right')
        
        plt.tight_layout()
        
        # Save
        output_path = output_dir / f'error_type_rescue_analysis_{comparison_key}.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"Saved error type rescue analysis: {output_path}")

    def create_cost_benefit_sensitivity_analysis(self, comparison_key, output_dir):
        """Create visualization showing ROI sensitivity to cost multipliers."""
        if comparison_key not in self.comparison_results:
            return
            
        analysis = self.comparison_results[comparison_key]
        
        # Test different cost multipliers
        cost_multipliers = np.arange(1, 11, 0.5)  # 1x to 10x in 0.5x increments
        roi_values = []
        profitability = []
        
        net_urls_gained = analysis['net_improvement']
        total_urls = analysis['matched_urls']
        
        for multiplier in cost_multipliers:
            # Calculate URLs gained per cost unit
            roi = net_urls_gained / (total_urls * multiplier)
            roi_values.append(roi)
            profitability.append(roi > 0)
        
        # Create visualization
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 10))
        
        # Plot 1: ROI curve
        colors = ['green' if profitable else 'red' for profitable in profitability]
        ax1.plot(cost_multipliers, roi_values, 'b-', linewidth=2, marker='o', markersize=4)
        ax1.axhline(y=0, color='red', linestyle='--', alpha=0.7, label='Break-even')
        ax1.fill_between(cost_multipliers, roi_values, 0, alpha=0.3, color='green', where=np.array(roi_values) > 0)
        ax1.fill_between(cost_multipliers, roi_values, 0, alpha=0.3, color='red', where=np.array(roi_values) < 0)
        
        ax1.set_xlabel('Cost Multiplier (x baseline)')
        ax1.set_ylabel('URLs Gained per Cost Unit')
        ax1.set_title(f'ROI Sensitivity Analysis\n({analysis["run1_name"]} → {analysis["run2_name"]})')
        ax1.grid(True, alpha=0.3)
        ax1.legend()
        
        # Add current analysis point
        current_multiplier = 5.0  # Default from the analysis
        current_roi = net_urls_gained / (total_urls * current_multiplier)
        ax1.plot(current_multiplier, current_roi, 'ro', markersize=10, label=f'Current Analysis (5.0x)')
        ax1.annotate(f'Current: {current_roi:.4f}', 
                    xy=(current_multiplier, current_roi), 
                    xytext=(current_multiplier + 1, current_roi + max(roi_values)*0.1),
                    arrowprops=dict(arrowstyle='->', color='red'))
        
        # Plot 2: Break-even analysis
        breakeven_multiplier = net_urls_gained / total_urls if total_urls > 0 else float('inf')
        
        multiplier_range = np.linspace(1, 10, 100)
        cost_per_url = total_urls * multiplier_range
        benefit_line = np.full_like(multiplier_range, net_urls_gained)
        
        ax2.plot(multiplier_range, cost_per_url / total_urls, 'r-', linewidth=2, label='Relative Cost')
        ax2.axhline(y=net_urls_gained / total_urls, color='green', linewidth=2, label='Relative Benefit')
        
        if breakeven_multiplier <= 10:
            ax2.axvline(x=breakeven_multiplier, color='orange', linestyle='--', 
                       label=f'Break-even at {breakeven_multiplier:.2f}x')
        
        ax2.set_xlabel('Cost Multiplier (x baseline)')
        ax2.set_ylabel('Relative Value (URLs/Total URLs)')
        ax2.set_title('Break-even Analysis')
        ax2.grid(True, alpha=0.3)
        ax2.legend()
        
        plt.tight_layout()
        
        # Save
        output_path = output_dir / f'cost_benefit_sensitivity_{comparison_key}.png'
        plt.savefig(output_path, dpi=300, bbox_inches='tight')
        plt.close()
        
        print(f"Saved cost-benefit sensitivity analysis: {output_path}")

    def create_transition_visualization(self, comparison_key, output_dir):
        """Create visualization of success/failure transitions."""
        if comparison_key not in self.comparison_results:
            raise ValueError(f"Comparison {comparison_key} not found")
        
        analysis = self.comparison_results[comparison_key]
        
        # Create transition matrix visualization
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        # Plot 1: Transition counts
        categories = ['Stable\nSuccess', 'Uplift\n(Rescue)', 'Falloff\n(Regression)', 'Stable\nFailure']
        counts = [
            analysis['stable_success'],
            analysis['uplift_count'], 
            analysis['falloff_count'],
            analysis['stable_failure']
        ]
        colors = ['green', 'lightgreen', 'orange', 'red']
        
        bars = ax1.bar(categories, counts, color=colors, alpha=0.7)
        ax1.set_ylabel('Number of URLs')
        ax1.set_title(f'URL Transitions: {analysis["run1_name"]} → {analysis["run2_name"]}', fontweight='bold')
        
        # Add count labels on bars
        for bar, count in zip(bars, counts):
            height = bar.get_height()
            ax1.text(bar.get_x() + bar.get_width()/2., height + max(counts)*0.01,
                    f'{count:,}', ha='center', va='bottom', fontweight='bold')
        
        ax1.grid(True, alpha=0.3, axis='y')
        
        # Plot 2: Success rate comparison
        runs = [analysis['run1_name'], analysis['run2_name']]
        success_rates = [analysis['run1_success_rate']*100, analysis['run2_success_rate']*100]
        
        bars2 = ax2.bar(runs, success_rates, color=['lightblue', 'darkblue'], alpha=0.7)
        ax2.set_ylabel('Success Rate (%)')
        ax2.set_title('Success Rate Comparison', fontweight='bold')
        ax2.set_ylim(0, 100)
        
        # Add percentage labels
        for bar, rate in zip(bars2, success_rates):
            height = bar.get_height()
            ax2.text(bar.get_x() + bar.get_width()/2., height + 1,
                    f'{rate:.1f}%', ha='center', va='bottom', fontweight='bold')
        
        # Add net improvement annotation
        net_improvement = analysis['net_improvement_rate'] * 100
        ax2.text(0.5, max(success_rates) - 10, 
                f'Net Improvement: {net_improvement:+.2f}%',
                ha='center', va='center', 
                bbox=dict(boxstyle='round,pad=0.5', facecolor='yellow', alpha=0.7),
                fontweight='bold', fontsize=12)
        
        ax2.grid(True, alpha=0.3, axis='y')
        
        plt.tight_layout()
        
        # Save the plot
        output_file = output_dir / f'transition_analysis_{comparison_key}.png'
        plt.savefig(output_file, dpi=300, bbox_inches='tight')
        print(f"Saved transition visualization: {output_file}")
        
        # plt.show()  # Disabled for batch processing
    
    def generate_roi_analysis(self, comparison_key, time_cost_multiplier=10):
        """Generate ROI analysis for strategy comparison."""
        if comparison_key not in self.comparison_results:
            raise ValueError(f"Comparison {comparison_key} not found")
        
        analysis = self.comparison_results[comparison_key]
        
        print(f"\n=== ROI ANALYSIS: {comparison_key} ===")
        
        # Calculate costs (assuming time_cost_multiplier represents relative compute cost)
        baseline_cost = 1.0  # Baseline = 1 unit
        advanced_cost = time_cost_multiplier
        
        # Calculate benefits
        urls_rescued = analysis['uplift_count']
        urls_lost = analysis['falloff_count']
        net_urls_gained = urls_rescued - urls_lost
        
        # ROI metrics
        roi_metrics = {
            'cost_multiplier': time_cost_multiplier,
            'urls_rescued': urls_rescued,
            'urls_lost': urls_lost,
            'net_urls_gained': net_urls_gained,
            'rescue_rate': analysis['rescue_rate'],
            'regression_rate': analysis['regression_rate'],
            'net_improvement_rate': analysis['net_improvement_rate'],
            'cost_per_rescued_url': time_cost_multiplier / urls_rescued if urls_rescued > 0 else float('inf'),
            'roi_ratio': net_urls_gained / (analysis['matched_urls'] * (time_cost_multiplier - 1)) if time_cost_multiplier > 1 else 0
        }
        
        print(f"Cost multiplier: {time_cost_multiplier}x baseline")
        print(f"URLs rescued: {urls_rescued:,}")
        print(f"URLs lost (regression): {urls_lost:,}")
        print(f"Net URLs gained: {net_urls_gained:,}")
        print(f"Rescue rate: {analysis['rescue_rate']*100:.1f}%")
        print(f"Regression rate: {analysis['regression_rate']*100:.1f}%")
        print(f"Cost per rescued URL: {roi_metrics['cost_per_rescued_url']:.2f}x baseline")
        
        if roi_metrics['roi_ratio'] > 0:
            print(f"✅ Strategy is profitable: {roi_metrics['roi_ratio']:.3f} URLs gained per cost unit")
        else:
            print(f"❌ Strategy is unprofitable: {roi_metrics['roi_ratio']:.3f}")
        
        return roi_metrics


def main():
    parser = argparse.ArgumentParser(description='Compare multiple download test runs for uplift/falloff analysis')
    parser.add_argument('csv_files', nargs='+', help='CSV files from download test results (2 or more)')
    parser.add_argument('-o', '--output', help='Output directory for charts (default: same as first input file)')
    parser.add_argument('--run-names', nargs='+', help='Names for each run (default: auto-generated from filenames)')
    parser.add_argument('--time-cost', type=float, default=10, help='Time cost multiplier for advanced strategies (default: 10)')
    parser.add_argument('--include-invalid-urls', action='store_true', 
                        help='Include invalid URLs (x-raw-image, etc) in comparison (default: exclude)')
    
    args = parser.parse_args()
    
    if len(args.csv_files) < 2:
        raise ValueError("Need at least 2 CSV files to compare")
    
    # Set up output directory
    if args.output:
        output_dir = Path(args.output)
    else:
        output_dir = Path(args.csv_files[0]).parent
    output_dir.mkdir(exist_ok=True)
    
    # Generate run names if not provided
    if args.run_names:
        if len(args.run_names) != len(args.csv_files):
            raise ValueError("Number of run names must match number of CSV files")
        run_names = args.run_names
    else:
        run_names = [Path(f).stem for f in args.csv_files]
    
    # Create comparator and load runs
    comparator = DownloadRunComparator()
    
    for csv_file, run_name in zip(args.csv_files, run_names):
        comparator.load_run(csv_file, run_name, args.include_invalid_urls)
    
    # Compare all adjacent pairs (sequential comparisons)
    for i in range(len(run_names) - 1):
        run1_name = run_names[i]
        run2_name = run_names[i + 1]
        
        # Perform comparison
        analysis = comparator.compare_runs(run1_name, run2_name)
        if analysis is None:
            continue
        
        comparison_key = f"{run1_name}_vs_{run2_name}"
        
        # Analyze patterns
        comparator.analyze_uplift_patterns(comparison_key)
        comparator.analyze_falloff_patterns(comparison_key)
        
        # Analyze rescuable URLs only
        comparator.analyze_rescuable_urls(comparison_key, output_dir)
        
        # Generate ROI analysis
        comparator.generate_roi_analysis(comparison_key, args.time_cost)
        
        # Create visualizations
        comparator.create_transition_visualization(comparison_key, output_dir)
        comparator.create_domain_performance_analysis(comparison_key, output_dir)
        comparator.create_error_type_rescue_analysis(comparison_key, output_dir)
        comparator.create_cost_benefit_sensitivity_analysis(comparison_key, output_dir)
    
    # Generate overall comparison matrix
    summary_df = comparator.generate_comparison_matrix()
    
    # Save summary to CSV
    if summary_df is not None:
        summary_file = output_dir / 'comparison_summary.csv'
        summary_df.to_csv(summary_file, index=False)
        print(f"\nSaved comparison summary: {summary_file}")
    
    # Save detailed results to JSON
    results_file = output_dir / 'detailed_comparison_results.json'
    
    # Prepare serializable results
    serializable_results = {}
    for key, analysis in comparator.comparison_results.items():
        # Remove the merged_data DataFrame which isn't JSON serializable
        serializable_analysis = {k: v for k, v in analysis.items() if k != 'merged_data'}
        serializable_results[key] = serializable_analysis
    
    with open(results_file, 'w') as f:
        json.dump(serializable_results, f, indent=2, default=str)
    
    print(f"Saved detailed results: {results_file}")


if __name__ == '__main__':
    main()