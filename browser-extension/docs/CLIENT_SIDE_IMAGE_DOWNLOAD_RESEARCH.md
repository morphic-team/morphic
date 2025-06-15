# Client-Side Image Download Research

## Problem Statement

Currently, Morphic downloads images server-side after the Chrome extension scrapes Google Images search results. This approach faces several challenges:

- **Anti-bot detection**: Some websites block requests from our backend server
- **Rate limiting**: Server IP may get throttled or blocked
- **Success rate**: Some images fail to download, reducing data completeness

## Proposed Solution

Enable the Chrome extension to download image binary data using the end user's connection, bypassing server-side blocking while maintaining server-side image processing capabilities (perceptual hashing, deduplication, thumbnailing).

## Technical Approaches Investigated

### 1. Content Script + fetch() Approach ❌

**Idea**: Content script downloads images directly using `fetch()`

**Problems**:
- **CORS restrictions**: Most image hosts don't allow cross-origin requests
- **Anti-bot detection**: Still bare HTTP requests without normal browsing fingerprint
- **No real advantage**: Same detection risks as server-side requests

**Code example**:
```javascript
// Would fail due to CORS
const response = await fetch(imageUrl);
const blob = await response.blob();
```

### 2. Background Script Processing ❌

**Idea**: 
- Content script scrapes URLs
- Background script downloads images (no CORS restrictions)
- Background script uploads to backend

**Problems**:
- **Still detectable**: Background script requests lack normal browsing context
- **Same anti-bot issues**: No cookies, session state, or realistic user fingerprint
- **Architecture complexity**: Message passing between content and background scripts

### 3. SERP Image Capture (Canvas Re-encoding) ⚠️

**Idea**: Capture already-loaded images from Google Images SERP

**Implementation**:
```javascript
const imgElement = resultContainer.querySelector('img');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
ctx.drawImage(imgElement, 0, 0);
const blob = await new Promise(resolve => canvas.toBlob(resolve));
```

**Advantages**:
- ✅ No additional network requests (stealth)
- ✅ No CORS issues
- ✅ 100% success rate for visible images
- ✅ Completely undetectable

**Disadvantages**:
- ❌ **Image quality loss**: Lossy-to-lossy re-encoding
- ❌ **Perceptual hash changes**: Re-encoding may affect duplicate detection
- ❌ **Thumbnail resolution**: Only captures small SERP thumbnails initially

### 4. Direct Binary Access from DOM ❌

**Idea**: Access already-loaded image binary data directly from `<img>` elements

**Wishful thinking**:
```javascript
const imgElement = document.querySelector('img');
const originalData = imgElement.srcData; // Does not exist!
```

**Reality**: Web APIs don't provide direct access to binary data of loaded images. This is a genuine gap in web platform capabilities.

### 5. Cache-Based fetch() ⚠️

**Idea**: Re-fetch image URLs that browser has already loaded (should hit cache)

**Implementation**:
```javascript
const imgElement = resultContainer.querySelector('img');
const response = await fetch(imgElement.src); // Hope for cache hit
const blob = await response.blob();
```

**Advantages**:
- ✅ Gets original binary data without re-encoding
- ✅ Should be fast (cache hit)
- ✅ Preserves image quality and perceptual hash

**Disadvantages**:
- ❌ **Detectability**: Creates duplicate network requests
- ❌ **Unusual patterns**: Normal users don't re-fetch displayed images
- ❌ **Project philosophy**: Goes against "fly under the radar" goal

### 6. Network Interception + Expanded View ❌

**Idea**: 
- Intercept network requests using `chrome.webRequest`
- Programmatically trigger expanded image views
- Capture high-resolution image URLs

**Implementation**:
```javascript
chrome.webRequest.onCompleted.addListener((details) => {
  // Intercept image URLs
}, {urls: ["<all_urls>"]});

// Trigger expanded view
resultElement.click();
```

**Problems**:
- ❌ **No response body access**: `chrome.webRequest` can't access binary response data
- ❌ **Still need fetch()**: Would still require separate requests for binary data
- ❌ **Same detectability issues**: Back to duplicate request problem

## Image Types Available

Google Images SERP provides at least two image versions:

1. **Small thumbnails**: Initially loaded in grid view
2. **Large versions**: Loaded when user clicks/expands individual results

## Key Constraints

### Project Requirements
- Maintain server-side image processing (perceptual hashing, deduplication)
- Maximize image collection success rate
- Support up to 400 images per search efficiently

### Stealth Requirements
- Avoid unusual network traffic patterns
- Don't break any explicit rules
- "Fly under the radar" - behave like normal users
- Minimize detectability by anti-bot systems

## Current Status

**No ideal solution identified** that satisfies all constraints:
- Canvas capture preserves stealth but loses image quality
- Direct fetch preserves quality but sacrifices stealth
- Network interception doesn't actually solve the core problem

## Recommendations

### Short-term: Empirical Testing
Before choosing an approach, gather data on:
1. How long would downloading 400 images via extension actually take?
2. What's the real-world quality loss from canvas re-encoding for perceptual hashing?
3. How often do server-side downloads actually fail?

### Potential Hybrid Approach
1. **Server-first**: Continue server-side downloads as primary method
2. **Client fallback**: Use canvas capture only for images that fail server-side
3. **Quality acceptance**: Accept that fallback images have lower quality
4. **User control**: Let users choose whether to help with failed downloads

### Future Research
- Investigate if `createImageBitmap()` provides better quality than canvas
- Test whether server-side download success rates can be improved with better user agents, retry logic, etc.
- Consider whether thumbnail-quality images are sufficient for research purposes

## Web Platform Limitations

This research highlighted a genuine gap in web APIs: there's no clean way to access the original binary data of already-loaded images without re-encoding or additional network requests. A hypothetical `imgElement.srcData` property would solve this entire problem elegantly.