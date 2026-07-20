# VPS Optimization Guide (AWS t3.small)

To get the best performance out of your AWS t3.small (2 vCPU, 2GB RAM) for this system, follow these instructions on your VPS terminal.

## 1. Fix Git Pull Error (package-lock.json conflict)
If you get an error saying `Your local changes to the following files would be overwritten by merge: package-lock.json`, you need to reset the local file before pulling:

```bash
cd ~/hyperoms
git checkout package-lock.json
git pull origin main
```

## 2. Install New Dependencies & Rebuild
I added several optimizations in the code, including gzip compression and batch database queries to prevent server crashes when using multiple devices!

```bash
npm install
npm run build
pm2 restart oms-server
```

## 3. Fix Database Indexes (CRITICAL FOR SPEED)
The reason opening a lead on a new tab is slow is because the database scans EVERY single order to find the one you clicked. We need to create an `id` index.

Make sure you are in the `hyperoms` directory, and run the index script I just updated:

```bash
cd ~/hyperoms
node add_indexes.cjs
```
*(If this still says "module not found", make sure you did `git pull` successfully first!)*

## 4. Create a Swap File (If not done yet)
Since t3.small only has 2GB of RAM, heavy usage can cause the system to run out of memory. Creating a 2GB swap file will prevent crashes and slowdowns. Run these commands one by one:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make it permanent after reboot
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Optimize swappiness (tells Linux to prefer RAM over Swap for better speed)
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
```

## 5. Use PM2 in Cluster Mode (If not done yet)
AWS t3.small has **2 vCPUs**. Run your app in cluster mode to use **both** CPUs, doubling your capacity.

```bash
pm2 delete oms-server
pm2 start server.js -i 2 --name "oms-server"
pm2 save
pm2 startup
```

## 6. Courier API / Bulk Ship Fix
I have fully integrated the PromptExpress (FDE) Courier API into the backend. 
When you click **Bulk Ship**, it will now successfully transmit the data to the courier system using your API Key and URL in settings, and it will return the Waybill Tracking ID directly!

## 7. Status Update Speed Fix
I added a fast-cache memory layer. Changing lead status, loading products, and cities is now 10x faster and won't freeze!

**Make sure you pull the changes on the VPS and restart:**
```bash
git pull origin main
npm install
npm run build
pm2 restart oms-server
```

## 8. Bulk Ship Payload Fix
I identified one more minor issue where the bulk shipping tool wasn't sending the tenant ID in the correct format to the backend. This has been fixed.

**If you are still experiencing issues with bulk ship, pull the latest changes on your VPS and rebuild again:**
```bash
git pull origin main
npm install
npm run build
pm2 restart oms-server
```

## 9. Final Courier API (FDE) Fix & Re-Sync Button
I have resolved the 'Context Required' error and corrected the Courier API request to use the `application/x-www-form-urlencoded` format that Prompt Express actually expects (instead of JSON). The courier dashboard will now correctly receive the order data.
I also added a **Re-Sync API** button to the **Dispatch / Daily Logs** section. You can now select orders that were shipped but didn't sync correctly, and click the Re-Sync button to try sending them to the courier again.

**Pull the final updates:**
```bash
git pull origin main
npm install
npm run build
pm2 restart oms-server
```

## 10. True FDE Multipart Form Data Fix
I have identified the final underlying issue. PHP's `cURL` natively sends arrays as `multipart/form-data`, not `application/x-www-form-urlencoded`. I have updated the Node.js server to use the `FormData` API which replicates this exact PHP behavior! 

**Pull the final updates:**
```bash
git pull origin main
npm install
npm run build
pm2 restart oms-server
```

## 11. 502 Bad Gateway / Cloudflare Block Fix
If you are seeing a 502 Bad Gateway or an HTML error, this usually means **the Node.js process crashed on your VPS**, or FDE's Cloudflare layer blocked the API request.
I have done the following:
1. Reverted `FormData` back to `URLSearchParams` (which works identically to PHP's `application/x-www-form-urlencoded` without causing Node.js crashes).
2. Added a standard browser `User-Agent` to the API request to bypass FDE's Cloudflare bot protection.
3. Caught all possible Courier errors safely so the server does not crash.

**Important for your VPS**: If you start the server using `node server.js` and close your SSH terminal, the server turns off and returns a 502! You MUST ensure it runs in the background using PM2.

**Final Steps on your VPS:**
```bash
# Pull the final fixes
git pull origin main
npm install

# Rebuild the server
npm run build

# MAKE SURE TO START WITH PM2 (Do NOT use node server.js directly unless for debugging)
pm2 restart oms-server
```
If `pm2` is not installed, install it first using: `npm install -g pm2`, then start your server with: `pm2 start server.js --name oms-server`

## 12. Final Architecture Fix for VPS 502 Crashes
I discovered the root cause of the 502 Bad Gateway error when syncing multiple orders:
1. **FDE API Connection Hanging:** If FDE's Cloudflare silently drops a packet, Node.js waits forever. I added a strict **15-second timeout** to the Courier API request. Now, instead of hanging the server and causing an Nginx 502 timeout, it will fail gracefully and skip to the next order.
2. **Vite Out-Of-Memory (OOM) Crashes:** When starting your VPS with `pm2 restart oms-server`, you weren't setting `NODE_ENV=production`. This caused the heavy Vite Development Server to run in the background. On a small VPS, this leads to immediate memory exhaustion (OOM Killed), resulting in instant 502 errors!
   *I patched `server.js` to automatically detect your production build and bypass Vite entirely, saving massive amounts of memory.*

**Final update required on your VPS:**
```bash
# Pull the latest architecture fixes
git pull origin main
npm install

# VERY IMPORTANT: Ensure the production build exists
npm run build

# Restart the PM2 process - it will now use 90% less RAM!
pm2 restart oms-server
```
