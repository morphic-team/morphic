#!/usr/bin/env python
"""
Reprocess existing download test results to mark invalid URLs.

This script takes an existing download test CSV and updates it to properly
mark x-raw-image and other unfetchable URL schemes as invalid_url failures,
allowing older test results to be used with the updated analysis scripts.
"""

import csv
import argparse
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime

def reprocess_invalid_urls(input_file, output_file=None):
    """Reprocess download results to mark invalid URLs."""
    
    print(f"Loading data from {input_file}...")
    
    # Read all data
    with open(input_file, 'r') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)
    
    print(f"Loaded {len(rows):,} records")
    
    # Ensure we have the columns we need
    if 'valid_url' not in fieldnames:
        fieldnames.append('valid_url')
    
    # Process each row
    updated_count = 0
    x_raw_count = 0
    other_invalid_count = 0
    
    for row in rows:
        direct_link = row.get('direct_link', '')
        
        # Check if this is an invalid URL scheme
        try:
            parsed = urlparse(direct_link)
            
            if parsed.scheme == 'x-raw-image':
                # Mark as invalid URL - only set fields that exist in the CSV
                if 'failure_stage' in row:
                    row['failure_stage'] = 'invalid_url'
                if 'error_type' in row:
                    row['error_type'] = 'unfetchable_scheme'
                if 'error_message' in row:
                    row['error_message'] = f"URL scheme '{parsed.scheme}' cannot be fetched"
                if 'final_success' in row:
                    row['final_success'] = 'False'
                row['valid_url'] = 'False'
                
                # Clear any incorrect success flags that might have been set
                for field in ['dns_resolution_success', 'tcp_connection_success', 
                             'ssl_handshake_success', 'http_request_success']:
                    if field in row:
                        row[field] = 'False'
                
                updated_count += 1
                x_raw_count += 1
                
            elif parsed.scheme not in ['http', 'https', '']:
                # Other invalid schemes
                if 'failure_stage' in row:
                    row['failure_stage'] = 'invalid_url'
                if 'error_type' in row:
                    row['error_type'] = 'unfetchable_scheme'
                if 'error_message' in row:
                    row['error_message'] = f"URL scheme '{parsed.scheme}' cannot be fetched"
                if 'final_success' in row:
                    row['final_success'] = 'False'
                row['valid_url'] = 'False'
                
                # Clear any incorrect success flags
                for field in ['dns_resolution_success', 'tcp_connection_success', 
                             'ssl_handshake_success', 'http_request_success']:
                    if field in row:
                        row[field] = 'False'
                
                updated_count += 1
                other_invalid_count += 1
            else:
                # Valid URL scheme
                row['valid_url'] = 'True'
        except:
            # If we can't parse the URL, assume it's valid and let other stages handle it
            row['valid_url'] = 'True'
    
    # Determine output file
    if not output_file:
        input_path = Path(input_file)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = input_path.parent / f"{input_path.stem}_reprocessed_{timestamp}.csv"
    
    # Write updated data
    print(f"\nWriting updated data to {output_file}...")
    with open(output_file, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    
    # Print summary
    print("\n=== REPROCESSING SUMMARY ===")
    print(f"Total records processed: {len(rows):,}")
    print(f"Records updated: {updated_count:,} ({updated_count/len(rows)*100:.1f}%)")
    print(f"  - x-raw-image URLs: {x_raw_count:,}")
    print(f"  - Other invalid schemes: {other_invalid_count:,}")
    print(f"\nOutput saved to: {output_file}")
    
    return output_file

def main():
    parser = argparse.ArgumentParser(description='Reprocess download results to mark invalid URLs')
    parser.add_argument('input_file', help='Input CSV file from download test')
    parser.add_argument('-o', '--output', help='Output CSV file (default: input_reprocessed_timestamp.csv)')
    
    args = parser.parse_args()
    
    # Run reprocessing
    reprocess_invalid_urls(args.input_file, args.output)

if __name__ == '__main__':
    main()