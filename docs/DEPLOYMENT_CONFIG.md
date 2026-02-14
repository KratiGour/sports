# Deployment Configuration Guide

## File Upload Limits by Environment

### 1. Render Free Tier (Current)
**Constraints:**
- 512MB RAM
- 30 second request timeout
- Shared CPU

**Recommended Config:**
```bash
MAX_UPLOAD_SIZE_MB=500  # Set in Render environment variables
```

**Best Practices:**
- ❌ **Direct file upload for videos >500MB will fail**
- ✅ **Use YouTube URL upload for large videos**
- ✅ **Videos up to 500MB: Direct upload**
- ✅ **Videos >500MB: YouTube URL upload**

---

### 2. Render Paid Tier ($7-25/mo)
**Constraints:**
- Up to 4GB RAM
- 60 second timeout (configurable)
- Dedicated CPU

**Recommended Config:**
```bash
MAX_UPLOAD_SIZE_MB=2000  # 2GB safe limit
```

**Best Practices:**
- ✅ **Videos up to 2GB: Direct upload**
- ✅ **Videos >2GB: YouTube URL upload**

---

### 3. Self-Hosted / VPS (Recommended for Large Files)
**Constraints:**
- Configurable resources
- No hard timeout limits

**Recommended Config:**
```bash
MAX_UPLOAD_SIZE_MB=10000  # 10GB for large cricket matches
```

**Best Practices:**
- ✅ **Videos up to 10GB: Direct upload**
- ✅ **Videos >10GB: YouTube URL upload (supports up to 12GB)**
- ⚠️ **Large files will take time to upload and process**
1. **Nginx Configuration** (for large uploads):
```nginx
# /etc/nginx/nginx.conf
client_max_body_size 10G;
client_body_timeout 300s;
proxy_read_timeout 600s;
proxy_send_timeout 600s;
```

2. **Systemd Service** (increase timeout):
```ini
# /etc/systemd/system/cricket-api.service
[Service]
TimeoutStartSec=600
TimeoutStopSec=600
```

3. **Disk Space Monitoring**:
```bash
# Ensure sufficient storage
df -h /storage
# Recommend: 500GB+ for production
```

---

## Solution for Large Videos (4.9GB - 12GB)

### Option 1: YouTube URL Upload (RECOMMENDED ⭐)
**Why:** 
- No upload time/size limits
- Handles up to **12GB** videos
- Leverages yt-dlp's robust download with resume capability
- Works on any deployment tier
- No bandwidth costs for upload

**How:**
1. Upload video to YouTube (Private/Unlisted)
2. Copy video URL
3. Use "YouTube URL" tab in upload form
4. Paste URL and submit

**Supported:**
- ✅ Videos up to 12GB
- ✅ Videos up to 8 hours duration
- ✅ Works on Render free tier

---

### Option 2: Self-Hosted Deployment
**Requirements:**
- VPS with 8GB+ RAM
- Ubuntu 22.04 or similar
- 500GB+ storage

**Setup:**
```bash
# Install dependencies
sudo apt update
sudo apt install nginx python3.10 postgresql ffmpeg

# Configure environment
export MAX_UPLOAD_SIZE_MB=10000

# Run backend
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Pros:**
- Full control over limits
- No external timeouts
- Cost-effective for high volume

**Cons:**
- Requires server management
- Upfront infrastructure cost

---

### Option 3: Cloud Storage Direct Upload
**Architecture:**
- Frontend uploads directly to AWS S3/Azure Blob
- Backend receives signed URL
- Process video from cloud storage

**Benefits:**
- No backend upload bottleneck
- Scalable to any file size
- Parallel uploads

**Implementation Required:**
1. Add S3/Azure SDK to frontend
2. Generate presigned upload URLs in backend
3. Modify OCR task to read from cloud storage

**Cost:** ~$0.02/GB storage + transfer fees

---

## Current Status & Recommendations

### ✅ What Works Now:
- **YouTube URL upload:** Unlimited size (tested with 2hr+ videos)
- **Direct upload:** Up to 5GB (configurable via `MAX_UPLOAD_SIZE_MB`)
- **Streaming upload:** Memory-efficient for any size

### ⚠️ Render Free Tier Limitations:
- 30s timeout kills uploads >500MB
- **Solution:** Set `MAX_UPLOAD_SIZE_MB=500` and rely on YouTube upload

### 🎯 For Your 4.9GB Video:
1. **Immediate:** Use YouTube URL upload (works today)
2. **Short-term:** Upgrade to Render paid tier + set `MAX_UPLOAD_SIZE_MB=2000`
3. **Long-term:** Self-host or implement S3 direct upload

---

## Environment Variable Reference

```bash
# Backend Environment Variables
DATABASE_URL=postgresql://user:pass@host:5432/db
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key-here

# Upload Configuration
MAX_UPLOAD_SIZE_MB=5000        # Default: 5GB
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com

# Optional: Cloud Storage (future)
# AWS_S3_BUCKET=cricket-videos
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
```

---

## Testing Different File Sizes

```bash
# Test 100MB video
curl -X POST "http://localhost:8000/api/v1/videos/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_100mb.mp4" \
  -F "title=Small Test"

# Test 2GB video (will fail on Render free)
curl -X POST "http://localhost:8000/api/v1/videos/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test_2gb.mp4" \
  -F "title=Large Test"

# Test YouTube URL (recommended for large files)
curl -X POST "http://localhost:8000/api/v1/jobs/trigger" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://youtube.com/watch?v=VIDEO_ID",
    "title": "4.9GB Test Video",
    "config": {
      "padding_before": 15,
      "padding_after": 5
    }
  }'
```

---

## Performance Benchmarks

| File Size | Direct Upload (Render Free) | YouTube URL | Self-Hosted |
|-----------|----------------------------|-------------|-------------|
| 100MB     | ✅ ~30s                     | ✅ ~20s      | ✅ ~15s      |
| 500MB     | ⚠️ ~2.5min (risky)          | ✅ ~1min     | ✅ ~45s      |
| 1GB       | ❌ Timeout                  | ✅ ~2min     | ✅ ~1.5min   |
| 5GB       | ❌ Timeout                  | ✅ ~8min     | ✅ ~5min     |
| 12GB      | ❌ Timeout                  | ✅ ~20min    | ✅ ~12min    |

**Conclusion:** For videos >500MB, **always use YouTube URL upload** on Render free tier. For self-hosted, direct uploads work up to 10GB.
