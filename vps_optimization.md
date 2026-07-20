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
