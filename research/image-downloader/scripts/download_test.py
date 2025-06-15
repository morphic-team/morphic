#!/usr/bin/env python
"""
Modular image download testing script with multiple strategies.

This script systematically tests image download success rates using different
download strategies to quantify improvement effectiveness for research purposes.

Strategies:
- baseline: Basic requests.get (original approach)
- best_python: Browser-like headers, user agents, retries, sessions
- browser_orchestration: (Future) Playwright/Selenium approach
- residential_proxy: (Future) Proxy rotation approach
"""

import csv
import json
import time
import random
import socket
import argparse
import requests
from datetime import datetime
from io import BytesIO
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlparse
import logging
import ssl
import dns.resolver
from PIL import Image, UnidentifiedImageError
import hashlib
from abc import ABC, abstractmethod
from collections import defaultdict, deque
import threading
import urllib3

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Suppress some noisy libraries
logging.getLogger('PIL').setLevel(logging.WARNING)
logging.getLogger('requests').setLevel(logging.WARNING)
logging.getLogger('urllib3').setLevel(logging.ERROR)  # Suppress connection pool warnings
logging.getLogger('urllib3.connectionpool').setLevel(logging.ERROR)

# Disable urllib3 connection pool warnings entirely
urllib3.disable_warnings(urllib3.exceptions.HTTPWarning)


class DownloadStrategy(ABC):
    """Abstract base class for download strategies."""
    
    def __init__(self, timeout=10):
        self.timeout = timeout
        
    @abstractmethod
    def download_image(self, url, result_dict):
        """
        Download image using this strategy.
        
        Args:
            url: Image URL to download
            result_dict: Pre-populated result dictionary to update
            
        Returns:
            Updated result_dict with strategy-specific results
        """
        pass
    
    @abstractmethod
    def get_strategy_name(self):
        """Return human-readable strategy name."""
        pass


class BaselineStrategy(DownloadStrategy):
    """Original basic requests.get approach."""
    
    def get_strategy_name(self):
        return "baseline"
    
    def download_image(self, url, result):
        """Basic requests.get download (original approach)."""
        request_start = time.time()
        try:
            response = requests.get(url, timeout=self.timeout, stream=True)
            
            # Calculate timing metrics
            total_time = time.time() - request_start
            result['total_download_time_ms'] = round(total_time * 1000, 2)
            result['tcp_connection_success'] = True
            parsed_url = urlparse(url)
            result['ssl_handshake_success'] = parsed_url.scheme == 'https'
            result['http_request_success'] = True
            
            # HTTP response analysis
            result['status_code'] = response.status_code
            result['response_headers_count'] = len(response.headers)
            result['content_type'] = response.headers.get('content-type', '')
            result['content_encoding'] = response.headers.get('content-encoding', '')
            result['server'] = response.headers.get('server', '')
            result['cache_control'] = response.headers.get('cache-control', '')
            result['last_modified'] = response.headers.get('last-modified', '')
            result['etag'] = response.headers.get('etag', '')
            result['content_length_reported'] = int(response.headers.get('content-length', 0) or 0)
            
            return self._process_response_content(response, result)
            
        except requests.exceptions.Timeout:
            result['failure_stage'] = 'http_timeout'
            result['error_type'] = 'timeout'
            result['error_message'] = f'Request timed out after {self.timeout}s'
            result['total_download_time_ms'] = round((time.time() - request_start) * 1000, 2)
        except requests.exceptions.ConnectionError as e:
            result['failure_stage'] = 'tcp_connection'
            result['error_type'] = 'connection_error'
            result['error_message'] = str(e)[:200]
            result['total_download_time_ms'] = round((time.time() - request_start) * 1000, 2)
        except requests.exceptions.SSLError as e:
            result['failure_stage'] = 'ssl_handshake'
            result['tcp_connection_success'] = True
            result['error_type'] = 'ssl_error'
            result['error_message'] = str(e)[:200]
            result['total_download_time_ms'] = round((time.time() - request_start) * 1000, 2)
        except Exception as e:
            result['failure_stage'] = 'http_request'
            result['error_type'] = type(e).__name__
            result['error_message'] = str(e)[:200]
            result['total_download_time_ms'] = round((time.time() - request_start) * 1000, 2)
        
        return result
    
    def _process_response_content(self, response, result):
        """Process response content and perform image validation."""
        # Only proceed with content download if we got a 200
        if response.status_code == 200:
            # Download content with TTFB measurement
            ttfb_start = time.time()
            content_chunks = []
            first_chunk = True
            
            for chunk in response.iter_content(chunk_size=8192):
                if first_chunk:
                    result['time_to_first_byte_ms'] = round((time.time() - ttfb_start) * 1000, 2)
                    first_chunk = False
                content_chunks.append(chunk)
            
            content = b''.join(content_chunks)
            result['content_length_actual'] = len(content)
            result['binary_payload_present'] = len(content) > 0
            
            # Content validation
            result['content_type_valid'] = any(img_type in result['content_type'].lower() 
                                             for img_type in ['image/', 'jpeg', 'png', 'gif', 'webp'])
            
            # Check for error pages
            if len(content) > 0:
                try:
                    content_sample = content[:1000].decode('utf-8', errors='ignore').lower()
                    result['appears_error_page'] = any(error_indicator in content_sample 
                                                     for error_indicator in [
                        '404 not found', 'access denied', 'forbidden', 'error', 
                        'not available', '<html', '<!doctype'
                    ])
                except:
                    result['appears_error_page'] = False
            
            # Image format validation
            if result['binary_payload_present'] and not result['appears_error_page']:
                try:
                    img = Image.open(BytesIO(content))
                    result['image_format_valid'] = True
                    result['image_format'] = img.format
                    result['image_width'] = img.width
                    result['image_height'] = img.height
                    result['image_mode'] = img.mode
                    result['image_has_transparency'] = img.mode in ('RGBA', 'LA') or 'transparency' in img.info
                    result['image_file_size'] = len(content)
                    
                    # Content hash for deduplication analysis
                    result['content_md5'] = hashlib.md5(content).hexdigest()
                    
                except UnidentifiedImageError:
                    result['image_format_valid'] = False
                    result['error_type'] = 'invalid_image_format'
                    result['error_message'] = 'Content is not a valid image'
                except Exception as e:
                    result['image_format_valid'] = False
                    result['error_type'] = f'image_processing_error'
                    result['error_message'] = str(e)[:200]
            
            # Final success determination
            result['final_success'] = (
                result['status_code'] == 200 and
                result['binary_payload_present'] and
                result['content_type_valid'] and
                result['image_format_valid'] and
                not result['appears_error_page']
            )
            
        else:
            # Non-200 status code
            result['failure_stage'] = 'http_status'
            result['error_type'] = f'http_{response.status_code}'
            result['error_message'] = f'HTTP {response.status_code} response'
        
        return result


class BestPythonStrategy(DownloadStrategy):
    """Browser-like approach with headers, user agents, retries, sessions."""
    
    def __init__(self, timeout=10, max_retries=3, max_workers=10, max_connections=1000):
        super().__init__(timeout)
        self.max_retries = max_retries
        self.max_workers = max_workers
        self.max_connections = max_connections
        self.user_agents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
        
        # Calculate optimal session pool configuration
        self._configure_session_pool()
        
        # Initialize session pool - each domain consistently maps to same session
        self.session_pool = []
        for i in range(self.session_pool_size):
            session = requests.Session()
            # Configure each session based on calculated parameters
            adapter = requests.adapters.HTTPAdapter(
                pool_connections=self.pool_connections_per_session,
                pool_maxsize=self.pool_maxsize_per_session,
                pool_block=False
            )
            session.mount('http://', adapter)
            session.mount('https://', adapter)
            self.session_pool.append(session)
        
        print(f"Session pool configured: {self.session_pool_size} sessions, "
              f"{self.pool_connections_per_session} pool_connections each, "
              f"{self.pool_maxsize_per_session} pool_maxsize each "
              f"(total capacity: {self.total_connection_capacity} connections)")
    
    def _configure_session_pool(self):
        """
        Dynamically configure session pool based on concurrency and connection limits.
        
        Strategy:
        - Session pool size scales with worker concurrency (more workers = more sessions needed)
        - Each session gets equal share of total connection budget
        - Ensure minimum viable pool sizes per session
        """
        # Base session pool size on worker concurrency
        # Rule: At least 1 session per 2 workers, minimum 10, maximum 200
        base_sessions = max(10, min(200, self.max_workers // 2))
        
        # Calculate connections per session if we used base number
        connections_per_session = self.max_connections // base_sessions
        
        # If connections per session would be too low, reduce session count
        min_connections_per_session = 5  # Minimum viable for connection pooling
        if connections_per_session < min_connections_per_session:
            self.session_pool_size = max(1, self.max_connections // min_connections_per_session)
            connections_per_session = self.max_connections // self.session_pool_size
        else:
            self.session_pool_size = base_sessions
        
        # Split connections between pool_connections and pool_maxsize
        # pool_connections = unique hosts, pool_maxsize = connections per host
        # Strategy: Target 4-8 connections per host for good throughput
        if connections_per_session <= 8:
            # Very low budget: minimal viable setup
            self.pool_connections_per_session = 2
            self.pool_maxsize_per_session = max(2, connections_per_session // 2)
        else:
            # Calculate for optimal throughput: aim for 4-8 connections per host
            target_maxsize = min(8, max(4, connections_per_session // 6))
            self.pool_maxsize_per_session = target_maxsize
            self.pool_connections_per_session = max(2, connections_per_session // target_maxsize)
        
        # Calculate actual total capacity for reporting
        self.total_connection_capacity = (self.session_pool_size * 
                                        self.pool_connections_per_session * 
                                        self.pool_maxsize_per_session)
    
    def get_session_for_domain(self, domain):
        """Get consistent session for a domain using hash-based sharding."""
        domain_hash = hash(domain)
        session_index = domain_hash % self.session_pool_size
        return self.session_pool[session_index]
    
    def cleanup(self):
        """Clean up session resources."""
        if hasattr(self, 'session_pool'):
            for session in self.session_pool:
                session.close()
    
    def get_strategy_name(self):
        return "best_python"
    
    def _get_browser_headers(self, url):
        """Generate realistic browser headers."""
        parsed = urlparse(url)
        user_agent = random.choice(self.user_agents)
        
        headers = {
            'User-Agent': user_agent,
            'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }
        
        # Add referrer for hotlink protection bypass
        if parsed.netloc not in ['localhost', '127.0.0.1']:
            headers['Referer'] = f"{parsed.scheme}://{parsed.netloc}/"
        
        # Browser-specific headers based on user agent
        if 'Chrome' in user_agent:
            headers.update({
                'Sec-Fetch-Dest': 'image',
                'Sec-Fetch-Mode': 'no-cors',
                'Sec-Fetch-Site': 'cross-site',
                'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"'
            })
        elif 'Firefox' in user_agent:
            headers['Sec-Fetch-Dest'] = 'image'
            headers['Sec-Fetch-Mode'] = 'no-cors'
            headers['Sec-Fetch-Site'] = 'cross-site'
        
        return headers
    
    def download_image(self, url, result):
        """Browser-like download with retries and realistic headers."""
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            if attempt > 0:
                # Exponential backoff
                backoff_time = 2 ** (attempt - 1)
                time.sleep(backoff_time)
                result[f'retry_{attempt}_delay_ms'] = backoff_time * 1000
            
            # Dynamic timeout increase on retries
            current_timeout = self.timeout * (1 + attempt * 0.5)
            result[f'attempt_{attempt + 1}_timeout'] = current_timeout
            
            request_start = time.time()
            try:
                # Fresh headers for each attempt
                headers = self._get_browser_headers(url)
                
                # Get session for this domain
                parsed_url = urlparse(url)
                session = self.get_session_for_domain(parsed_url.netloc)
                
                response = session.get(
                    url, 
                    headers=headers,
                    timeout=current_timeout, 
                    stream=True,
                    allow_redirects=True
                )
                
                # Calculate timing metrics
                total_time = time.time() - request_start
                result['total_download_time_ms'] = round(total_time * 1000, 2)
                result['successful_attempt'] = attempt + 1
                result['tcp_connection_success'] = True
                parsed_url = urlparse(url)
                result['ssl_handshake_success'] = parsed_url.scheme == 'https'
                result['http_request_success'] = True
                result['used_user_agent'] = headers['User-Agent']
                result['total_attempts'] = attempt + 1
                
                # HTTP response analysis
                result['status_code'] = response.status_code
                result['response_headers_count'] = len(response.headers)
                result['content_type'] = response.headers.get('content-type', '')
                result['content_encoding'] = response.headers.get('content-encoding', '')
                result['server'] = response.headers.get('server', '')
                result['cache_control'] = response.headers.get('cache-control', '')
                result['last_modified'] = response.headers.get('last-modified', '')
                result['etag'] = response.headers.get('etag', '')
                result['content_length_reported'] = int(response.headers.get('content-length', 0) or 0)
                
                # Check for rate limiting that might need longer backoff
                if response.status_code in [429, 503]:
                    result[f'attempt_{attempt + 1}_rate_limited'] = True
                    retry_after = response.headers.get('Retry-After')
                    if retry_after and attempt < self.max_retries:
                        try:
                            wait_time = int(retry_after)
                            time.sleep(min(wait_time, 60))  # Cap at 60 seconds
                            result[f'retry_after_wait_{attempt + 1}'] = wait_time
                        except ValueError:
                            pass
                    continue
                
                try:
                    return self._process_response_content(response, result)
                finally:
                    # Ensure response is closed to free memory
                    response.close()
                
            except requests.exceptions.Timeout:
                last_exception = f'timeout_attempt_{attempt + 1}'
                result[f'attempt_{attempt + 1}_timeout_failure'] = True
                result['total_download_time_ms'] = round((time.time() - request_start) * 1000, 2)
                if attempt == self.max_retries:
                    result['failure_stage'] = 'http_timeout'
                    result['error_type'] = 'timeout_all_attempts'
                    result['error_message'] = f'All {self.max_retries + 1} attempts timed out'
            except requests.exceptions.ConnectionError as e:
                last_exception = f'connection_error_attempt_{attempt + 1}'
                result[f'attempt_{attempt + 1}_connection_failure'] = True
                if attempt == self.max_retries:
                    result['failure_stage'] = 'tcp_connection'
                    result['error_type'] = 'connection_error_all_attempts'
                    result['error_message'] = str(e)[:200]
            except requests.exceptions.SSLError as e:
                last_exception = f'ssl_error_attempt_{attempt + 1}'
                result[f'attempt_{attempt + 1}_ssl_failure'] = True
                result['tcp_connection_success'] = True
                if attempt == self.max_retries:
                    result['failure_stage'] = 'ssl_handshake'
                    result['error_type'] = 'ssl_error_all_attempts'
                    result['error_message'] = str(e)[:200]
            except Exception as e:
                last_exception = f'unknown_error_attempt_{attempt + 1}'
                result[f'attempt_{attempt + 1}_unknown_failure'] = True
                if attempt == self.max_retries:
                    result['failure_stage'] = 'http_request'
                    result['error_type'] = f'{type(e).__name__}_all_attempts'
                    result['error_message'] = str(e)[:200]
        
        result['total_attempts'] = self.max_retries + 1
        result['all_attempts_failed'] = True
        return result
    
    def _process_response_content(self, response, result):
        """Process response content and perform image validation (shared with baseline)."""
        # Reuse the same content processing logic as baseline
        baseline_strategy = BaselineStrategy()
        return baseline_strategy._process_response_content(response, result)


class HostThrottler:
    """Throttles requests to prevent too many simultaneous requests per host."""
    
    def __init__(self, max_concurrent_per_host=2):
        self.max_concurrent_per_host = max_concurrent_per_host
        self.host_counters = defaultdict(int)
        self.host_queues = defaultdict(deque)
        self.lock = threading.Lock()
    
    def can_process_host(self, host):
        """Check if we can process another request for this host."""
        with self.lock:
            return self.host_counters[host] < self.max_concurrent_per_host
    
    def acquire_host_slot(self, host):
        """Acquire a slot for processing this host."""
        with self.lock:
            if self.host_counters[host] < self.max_concurrent_per_host:
                self.host_counters[host] += 1
                return True
            return False
    
    def release_host_slot(self, host):
        """Release a slot for this host."""
        with self.lock:
            if self.host_counters[host] > 0:
                self.host_counters[host] -= 1


class DownloadTester:
    """Main testing orchestrator supporting multiple download strategies."""
    
    def __init__(self, strategy, max_workers=10, max_concurrent_per_host=2, use_os_dns=False):
        self.strategy = strategy
        self.max_workers = max_workers
        self.max_concurrent_per_host = max_concurrent_per_host
        self.use_os_dns = use_os_dns
        self.results = []
        self.host_throttler = HostThrottler(max_concurrent_per_host)
        
    def test_single_download(self, row):
        """
        Comprehensive download test with full validation stack using specified strategy.
        Returns detailed results for analysis across all failure points.
        """
        search_result_id = row['search_result_id']
        direct_link = row['direct_link']
        visible_link = row['visible_link']
        
        # Initialize comprehensive result structure
        result = {
            'search_result_id': search_result_id,
            'direct_link': direct_link,
            'visible_link': visible_link,
            'survey_id': row['survey_id'],
            'search_id': row['search_id'],
            'original_state': row['image_scraped_state'],
            'test_timestamp': datetime.now().isoformat(),
            'strategy': self.strategy.get_strategy_name(),
            
            # Network stack validation
            'dns_resolution_success': False,
            'dns_resolution_time_ms': None,
            'tcp_connection_success': False,
            'ssl_handshake_success': False,
            'http_request_success': False,
            
            # HTTP response details
            'status_code': None,
            'response_headers_count': 0,
            'content_type': '',
            'content_encoding': '',
            'server': '',
            'cache_control': '',
            'last_modified': '',
            'etag': '',
            
            # Timing metrics
            'total_download_time_ms': None,
            'time_to_first_byte_ms': None,
            'dns_lookup_time_ms': None,
            'connect_time_ms': None,
            'ssl_handshake_time_ms': None,
            
            # Content validation
            'content_length_reported': 0,
            'content_length_actual': 0,
            'content_type_valid': False,
            'binary_payload_present': False,
            'appears_error_page': False,
            
            # Image validation
            'image_format_valid': False,
            'image_format': '',
            'image_width': None,
            'image_height': None,
            'image_mode': '',
            'image_has_transparency': False,
            'image_file_size': 0,
            'content_md5': '',
            
            # Final determination
            'final_success': False,
            'failure_stage': None,
            'error_type': None,
            'error_message': None
        }
        
        # Extract domain for analysis
        try:
            parsed_url = urlparse(direct_link)
            result['domain'] = parsed_url.netloc.lower()
            result['url_scheme'] = parsed_url.scheme
            result['url_path_depth'] = len([p for p in parsed_url.path.split('/') if p])
            result['has_query_params'] = bool(parsed_url.query)
            
            # Check for invalid URL schemes that can't be fetched
            if parsed_url.scheme == 'x-raw-image':
                result['failure_stage'] = 'invalid_url'
                result['error_type'] = 'unfetchable_scheme'
                result['error_message'] = f"URL scheme '{parsed_url.scheme}' cannot be fetched"
                return result
                
        except:
            result['domain'] = 'unknown'
            result['url_scheme'] = 'unknown'
            result['url_path_depth'] = 0
            result['has_query_params'] = False
        
        # Stage 1: DNS Resolution (if not using OS DNS)
        if not getattr(self, 'use_os_dns', False):
            dns_start = time.time()
            try:
                answers = dns.resolver.resolve(parsed_url.netloc, 'A')
                result['dns_resolution_success'] = True
                result['dns_resolution_time_ms'] = round((time.time() - dns_start) * 1000, 2)
                result['resolved_ips'] = [str(answer) for answer in answers]
            except dns.resolver.NXDOMAIN:
                result['dns_resolution_time_ms'] = round((time.time() - dns_start) * 1000, 2)
                result['failure_stage'] = 'dns'
                result['error_type'] = 'nxdomain'
                result['error_message'] = 'Domain does not exist'
                return result
            except dns.resolver.Timeout:
                result['dns_resolution_time_ms'] = round((time.time() - dns_start) * 1000, 2)
                result['failure_stage'] = 'dns'
                result['error_type'] = 'dns_timeout'
                result['error_message'] = 'DNS resolution timed out'
                return result
            except dns.resolver.NoAnswer:
                result['dns_resolution_time_ms'] = round((time.time() - dns_start) * 1000, 2)
                result['failure_stage'] = 'dns'
                result['error_type'] = 'dns_resolution_failed'
                result['error_message'] = 'No A record found'
                return result
            except Exception as e:
                result['dns_resolution_time_ms'] = round((time.time() - dns_start) * 1000, 2)
                result['failure_stage'] = 'dns'
                result['error_type'] = type(e).__name__
                result['error_message'] = str(e)[:200]
                return result
        else:
            # Skip explicit DNS resolution, let OS/requests handle it
            dns_start = time.time()
            try:
                # Quick test to see if domain resolves
                socket.gethostbyname(parsed_url.netloc)
                result['dns_resolution_success'] = True
                result['dns_resolution_time_ms'] = round((time.time() - dns_start) * 1000, 2)
                result['resolved_ips'] = ['os_resolved']  # Placeholder
            except socket.gaierror as e:
                result['dns_resolution_time_ms'] = round((time.time() - dns_start) * 1000, 2)
                result['failure_stage'] = 'dns'
                result['error_type'] = 'os_dns_error'
                result['error_message'] = str(e)[:200]
                return result
        
        # Stage 2+: Use strategy-specific download logic
        result = self.strategy.download_image(direct_link, result)
        
        return result
    
    def run_test(self, csv_file, sample_size=None, random_sample=False, output_file=None):
        """Run download test with current strategy."""
        # Load CSV data
        with open(csv_file, 'r') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        
        print(f"Loaded {len(rows):,} records from {csv_file}")
        
        # Sample if requested
        if sample_size and sample_size < len(rows):
            if random_sample:
                rows = random.sample(rows, sample_size)
                print(f"Selected random sample of {sample_size:,} records")
            else:
                rows = rows[:sample_size]
                print(f"Selected first {sample_size:,} records")
        
        print(f"Testing {len(rows):,} URLs using '{self.strategy.get_strategy_name()}' strategy...")
        
        # Process with thread pool
        start_time = time.time()
        self.results = []
        success_count = 0  # Track success count incrementally
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            future_to_row = {executor.submit(self.test_single_download, row): row for row in rows}
            
            for i, future in enumerate(as_completed(future_to_row), 1):
                try:
                    result = future.result()
                    self.results.append(result)
                    
                    # Increment success count if successful
                    if result.get('final_success', False):
                        success_count += 1
                    
                    if i % 100 == 0:
                        elapsed = time.time() - start_time
                        rate = i / elapsed
                        eta = (len(rows) - i) / rate if rate > 0 else 0
                        success_rate = (success_count / i) * 100
                        print(f"Processed {i:,}/{len(rows):,} ({i/len(rows)*100:.1f}%) | "
                              f"Success rate: {success_rate:.1f}% | "
                              f"Rate: {rate:.1f}/sec | ETA: {eta/60:.1f}min")
                        
                except Exception as e:
                    logger.error(f"Error processing row: {e}")
        
        # Generate output filename if not provided
        if not output_file:
            from pathlib import Path
            input_dir = Path(csv_file).parent
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            strategy_name = self.strategy.get_strategy_name()
            sample_suffix = f"_sample{sample_size}" if sample_size else ""
            output_file = input_dir / f"download_test_{strategy_name}{sample_suffix}_{timestamp}.csv"
        
        # Save results
        self._save_results(output_file)
        self._print_summary()
        
        return output_file
    
    def _save_results(self, output_file):
        """Save detailed results to CSV."""
        if not self.results:
            print("No results to save")
            return
        
        # Get all possible field names from results
        all_fields = set()
        for result in self.results:
            all_fields.update(result.keys())
        
        # Sort fields for consistent output
        fieldnames = sorted(all_fields)
        
        with open(output_file, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(self.results)
        
        print(f"Saved detailed results to {output_file}")
    
    def _print_summary(self):
        """Print summary statistics."""
        if not self.results:
            return
        
        total = len(self.results)
        final_success = sum(1 for r in self.results if r['final_success'])
        
        print(f"\n=== DOWNLOAD TEST SUMMARY ({self.strategy.get_strategy_name()}) ===")
        print(f"Total URLs tested: {total:,}")
        print(f"Final success: {final_success:,} ({final_success/total*100:.1f}%)")
        
        # Failure stage breakdown
        failure_stages = {}
        for result in self.results:
            if not result['final_success'] and result.get('failure_stage'):
                stage = result['failure_stage']
                failure_stages[stage] = failure_stages.get(stage, 0) + 1
        
        if failure_stages:
            print("\nFailure stages:")
            for stage, count in sorted(failure_stages.items(), key=lambda x: x[1], reverse=True):
                print(f"  {stage}: {count:,} ({count/total*100:.1f}%)")


def main():
    parser = argparse.ArgumentParser(description='Multi-strategy image download testing')
    parser.add_argument('csv_file', help='CSV file with search result data')
    parser.add_argument('--strategy', choices=['baseline', 'best_python'], default='baseline',
                        help='Download strategy to use (default: baseline)')
    parser.add_argument('-s', '--sample', type=int, help='Sample size for testing (default: all)')
    parser.add_argument('--random', action='store_true', help='Use random sampling instead of first N records')
    parser.add_argument('-w', '--workers', type=int, default=10, help='Number of concurrent workers (default: 10)')
    parser.add_argument('-t', '--timeout', type=int, default=10, help='Request timeout in seconds (default: 10)')
    parser.add_argument('--max-connections', type=int, default=1000, help='Maximum total HTTP connections to maintain (default: 1000)')
    parser.add_argument('--use-os-dns', action='store_true', help='Use OS DNS resolution instead of python dns library (may improve performance)')
    parser.add_argument('-o', '--output', help='Output CSV file (default: auto-generated in input directory)')
    
    args = parser.parse_args()
    
    # Create strategy instance
    if args.strategy == 'baseline':
        strategy = BaselineStrategy(timeout=args.timeout)
    elif args.strategy == 'best_python':
        strategy = BestPythonStrategy(
            timeout=args.timeout, 
            max_workers=args.workers, 
            max_connections=args.max_connections
        )
    else:
        raise ValueError(f"Unknown strategy: {args.strategy}")
    
    # Create tester and run
    tester = DownloadTester(strategy=strategy, max_workers=args.workers, use_os_dns=args.use_os_dns)
    try:
        output_file = tester.run_test(
            csv_file=args.csv_file,
            sample_size=args.sample,
            random_sample=args.random,
            output_file=args.output
        )
        
        print(f"\nTest complete! Results saved to: {output_file}")
    finally:
        # Clean up strategy resources
        if hasattr(strategy, 'cleanup'):
            strategy.cleanup()


if __name__ == '__main__':
    main()