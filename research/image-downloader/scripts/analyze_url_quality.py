#!/usr/bin/env python
"""
Analyze URL quality in search results dataset.

This script analyzes the direct_link URLs to understand:
- Protocol distribution (http, https, x-raw-image, etc.)
- Non-standard ports
- Unparseable URLs
- Domain distribution
- File extensions
- URL anomalies
"""

import csv
import json
import argparse
from urllib.parse import urlparse, parse_qs
from collections import Counter, defaultdict
import re
from pathlib import Path

def load_and_analyze_urls(csv_path, sample_size=None):
    """Analyze URL quality and characteristics."""
    
    # Counters
    protocol_counter = Counter()
    port_counter = Counter()
    domain_counter = Counter()
    extension_counter = Counter()
    parse_failures = []
    anomalies = defaultdict(list)
    total_rows = 0
    empty_urls = 0
    
    # Patterns
    file_ext_pattern = re.compile(r'\.([a-zA-Z0-9]{1,5})(?:\?|$|#)')
    
    print(f"Analyzing URLs from: {csv_path}")
    print("=" * 80)
    
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        
        for i, row in enumerate(reader):
            if sample_size and i >= sample_size:
                break
                
            total_rows += 1
            direct_link = row.get('direct_link', '').strip()
            search_result_id = row.get('search_result_id', 'unknown')
            
            # Check for empty URLs
            if not direct_link:
                empty_urls += 1
                anomalies['empty_url'].append({
                    'id': search_result_id,
                    'visible_link': row.get('visible_link', '')
                })
                continue
            
            # Try to parse URL
            try:
                parsed = urlparse(direct_link)
                
                # Protocol analysis
                scheme = parsed.scheme.lower() if parsed.scheme else 'no_scheme'
                protocol_counter[scheme] += 1
                
                # Check for unusual protocols
                if scheme not in ['http', 'https', '']:
                    anomalies['unusual_protocol'].append({
                        'id': search_result_id,
                        'protocol': scheme,
                        'url': direct_link[:100]
                    })
                
                # Domain analysis
                if parsed.netloc:
                    domain = parsed.netloc.lower()
                    domain_counter[domain] += 1
                    
                    # Port analysis
                    if ':' in domain:
                        try:
                            port = domain.split(':')[-1]
                            port_counter[port] += 1
                            if port not in ['80', '443']:
                                anomalies['non_standard_port'].append({
                                    'id': search_result_id,
                                    'port': port,
                                    'domain': domain
                                })
                        except:
                            pass
                else:
                    anomalies['no_domain'].append({
                        'id': search_result_id,
                        'url': direct_link[:100]
                    })
                
                # File extension analysis
                if parsed.path:
                    ext_match = file_ext_pattern.search(parsed.path)
                    if ext_match:
                        extension = ext_match.group(1).lower()
                        extension_counter[extension] += 1
                    
                    # Check for suspicious paths
                    if len(parsed.path) > 500:
                        anomalies['very_long_path'].append({
                            'id': search_result_id,
                            'path_length': len(parsed.path),
                            'url': direct_link[:100] + '...'
                        })
                
                # Query string analysis
                if parsed.query and len(parsed.query) > 1000:
                    anomalies['very_long_query'].append({
                        'id': search_result_id,
                        'query_length': len(parsed.query),
                        'url': direct_link[:100] + '...'
                    })
                    
            except Exception as e:
                parse_failures.append({
                    'id': search_result_id,
                    'error': str(e),
                    'url': direct_link[:100]
                })
    
    # Print analysis results
    print(f"\nTOTAL URLs analyzed: {total_rows:,}")
    print(f"Empty URLs: {empty_urls:,} ({empty_urls/total_rows*100:.1f}%)")
    print(f"Parse failures: {len(parse_failures):,} ({len(parse_failures)/total_rows*100:.1f}%)")
    
    print("\nPROTOCOL DISTRIBUTION:")
    for protocol, count in protocol_counter.most_common():
        print(f"  {protocol:20} {count:8,} ({count/total_rows*100:6.2f}%)")
    
    print("\nTOP 30 DOMAINS:")
    for domain, count in domain_counter.most_common(30):
        print(f"  {count:6,} {domain}")
    
    print("\nFILE EXTENSIONS:")
    for ext, count in extension_counter.most_common(20):
        print(f"  .{ext:10} {count:8,} ({count/total_rows*100:6.2f}%)")
    
    print("\nPORT DISTRIBUTION:")
    for port, count in port_counter.most_common():
        print(f"  :{port:10} {count:8,}")
    
    print("\nANOMALIES FOUND:")
    for anomaly_type, items in anomalies.items():
        print(f"\n{anomaly_type.upper()}: {len(items)} cases")
        # Show first 5 examples
        for item in items[:5]:
            print(f"  - {item}")
        if len(items) > 5:
            print(f"  ... and {len(items) - 5} more")
    
    if parse_failures:
        print(f"\nURL PARSE FAILURES: {len(parse_failures)} cases")
        for failure in parse_failures[:5]:
            print(f"  - ID: {failure['id']}, Error: {failure['error']}")
            print(f"    URL: {failure['url']}")
        if len(parse_failures) > 5:
            print(f"  ... and {len(parse_failures) - 5} more")
    
    # Check for x-raw-image specifically
    x_raw_count = protocol_counter.get('x-raw-image', 0)
    if x_raw_count > 0:
        print(f"\nSPECIAL NOTE: Found {x_raw_count:,} x-raw-image:/// URLs")
        print("These appear to be Google's internal image protocol references")
    
    return {
        'total': total_rows,
        'empty': empty_urls,
        'parse_failures': len(parse_failures),
        'protocols': dict(protocol_counter),
        'anomalies': {k: len(v) for k, v in anomalies.items()}
    }


def main():
    parser = argparse.ArgumentParser(description='Analyze URL quality in search results')
    parser.add_argument('csv_file', help='Path to search results CSV file')
    parser.add_argument('-s', '--sample', type=int, help='Sample size to analyze (default: all)')
    parser.add_argument('-o', '--output-dir', type=Path, 
                        help='Output directory for results (default: same as input)')
    
    args = parser.parse_args()
    
    # Set output directory
    if args.output_dir:
        output_dir = args.output_dir
        output_dir.mkdir(parents=True, exist_ok=True)
    else:
        output_dir = Path(args.csv_file).parent
    
    # Run analysis
    results = load_and_analyze_urls(args.csv_file, args.sample)
    
    # Save summary
    summary_file = output_dir / 'url_quality_summary.json'
    with open(summary_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nSummary saved to: {summary_file}")

if __name__ == '__main__':
    main()