#!/usr/bin/env python
"""
Add strategy column to legacy download test results.

This script takes an old download test CSV (e.g., from baseline_download_test.py)
and adds the 'strategy' column to make it compatible with the new download_test.py
format and comparison scripts.

Usage:
  python add_strategy_column.py <input_csv> [options]

Options:
  -s, --strategy STRATEGY    Strategy name to add (default: baseline)
  -o, --output OUTPUT        Output file (default: input_with_strategy_YYYYMMDD_HHMMSS.csv)

Examples:
  python add_strategy_column.py data/old_baseline_results.csv
  python add_strategy_column.py data/legacy_download.csv -s baseline -o data/baseline_with_strategy.csv
"""

import csv
import argparse
from pathlib import Path
from datetime import datetime

def add_strategy_column(input_file, strategy_name, output_file=None):
    """Add strategy column to download test results."""
    
    print(f"Loading data from {input_file}...")
    
    # Read all data
    with open(input_file, 'r') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)
    
    print(f"Loaded {len(rows):,} records")
    
    # Check if strategy column already exists
    if 'strategy' in fieldnames:
        print(f"⚠️  Strategy column already exists with values:")
        strategy_counts = {}
        for row in rows:
            strategy = row.get('strategy', 'unknown')
            strategy_counts[strategy] = strategy_counts.get(strategy, 0) + 1
        
        for strategy, count in strategy_counts.items():
            print(f"  {strategy}: {count:,} records")
        
        user_input = input(f"\nOverwrite existing strategy column with '{strategy_name}'? [y/N]: ")
        if user_input.lower() not in ['y', 'yes']:
            print("Cancelled - no changes made")
            return None
    else:
        # Add strategy to fieldnames
        fieldnames = list(fieldnames) + ['strategy']
    
    # Add strategy column to all rows
    updated_count = 0
    for row in rows:
        row['strategy'] = strategy_name
        updated_count += 1
    
    # Determine output file
    if not output_file:
        input_path = Path(input_file)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = input_path.parent / f"{input_path.stem}_with_strategy_{timestamp}.csv"
    
    # Write updated data
    print(f"\nWriting updated data to {output_file}...")
    with open(output_file, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    # Print summary
    print("\n=== STRATEGY COLUMN ADDITION SUMMARY ===")
    print(f"Input file: {input_file}")
    print(f"Output file: {output_file}")
    print(f"Total records: {len(rows):,}")
    print(f"Strategy added: '{strategy_name}' to all {updated_count:,} records")
    
    # Verify output
    file_size = Path(output_file).stat().st_size
    print(f"Output file size: {file_size:,} bytes")
    
    return output_file

def main():
    parser = argparse.ArgumentParser(description='Add strategy column to legacy download test results')
    parser.add_argument('input_file', help='Input CSV file from download test')
    parser.add_argument('-s', '--strategy', default='baseline', 
                        help='Strategy name to add (default: baseline)')
    parser.add_argument('-o', '--output', help='Output CSV file (default: auto-generated)')
    
    args = parser.parse_args()
    
    # Validate input file
    if not Path(args.input_file).exists():
        print(f"❌ Input file not found: {args.input_file}")
        return 1
    
    # Validate strategy name
    valid_strategies = ['baseline', 'best_python', 'browser_orchestration', 'residential_proxy']
    if args.strategy not in valid_strategies:
        print(f"⚠️  Warning: '{args.strategy}' is not a standard strategy name")
        print(f"Standard strategies: {', '.join(valid_strategies)}")
        user_input = input("Continue anyway? [y/N]: ")
        if user_input.lower() not in ['y', 'yes']:
            return 1
    
    # Run the addition
    try:
        output_file = add_strategy_column(args.input_file, args.strategy, args.output)
        if output_file:
            print(f"\n✅ Strategy column successfully added!")
            print(f"📁 Updated file: {output_file}")
            
            # Suggest next steps
            print(f"\n📝 Next Steps:")
            print(f"1. Use this file with comparison scripts:")
            print(f"   python scripts/compare_download_runs.py {output_file} <other_results.csv>")
            print(f"2. Or run analysis:")
            print(f"   python scripts/analyze_funnel_by_id.py {output_file}")
        
        return 0
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1

if __name__ == '__main__':
    exit(main())