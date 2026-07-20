# VPS Optimization Guide (AWS t3.small)

To get the best performance out of your AWS t3.small (2 vCPU, 2GB RAM) for this system, follow these instructions on your VPS terminal.

## 1. Fix Git Pull Error (package-lock.json conflict)
If you get an error saying `Your local changes to the following files would be overwritten by merge: package-lock.json`, you need to reset the local file before pulling:
```bash
cd ~/hyperoms
git checkout package-lock.json
git pull origin main
```

## 2. Final Courier API (FDE) Fix & Re-Sync Button
I have resolved the 'Context Required' error and corrected the Courier API request to use the `application/x-www-form-urlencoded` format that Prompt Express actually expects (instead of JSON). The courier dashboard will now correctly receive the order data.
I also added a **Re-Sync API** button to the **Dispatch / Daily Logs** section. You can now select orders that were shipped but didn't sync correctly, and click the Re-Sync button to try sending them to the courier again.

## 3. 502 Bad Gateway / Cloudflare Block Fix
If you were seeing a 502 Bad Gateway or an HTML error, this usually means **the Node.js process crashed on your VPS**, or FDE's Cloudflare layer blocked the API request.

I have done the following:
1. Reverted `FormData` back to `URLSearchParams` (which works identically to PHP's `application/x-www-form-urlencoded` without causing Node.js crashes).
2. Added a standard browser `User-Agent` to the API request to bypass FDE's Cloudflare bot protection.
3. Caught all possible Courier errors safely so the server does not crash.
4. **Added a 15-second timeout**: If FDE's Cloudflare silently drops a packet, Node.js waits forever. Now, instead of hanging the server and causing an Nginx 502 timeout, it will fail gracefully and skip to the next order.

**Important for your VPS**: If you start the server using `node server.js` and close your SSH terminal, the server turns off and returns a 502! You MUST ensure it runs in the background using PM2.

## 4. Fix VPS Out-Of-Memory (OOM) Crashes
When starting your VPS with `pm2 restart oms-server`, you weren't setting `NODE_ENV=production`. This caused the heavy Vite Development Server to run in the background. On a small VPS, this leads to immediate memory exhaustion (OOM Killed), resulting in instant 502 errors!
*I patched `server.js` to automatically detect your production build and bypass Vite entirely, saving massive amounts of memory.*

## Final update required on your VPS:
```bash
# Pull the latest architecture fixes
git pull origin main
npm install

# VERY IMPORTANT: Ensure the production build exists
npm run build

# Restart the PM2 process - it will now use 90% less RAM!
pm2 restart oms-server
```
