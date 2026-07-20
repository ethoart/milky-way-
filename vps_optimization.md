# VPS Optimization Guide (AWS t3.small)

To get the best performance out of your AWS t3.small (2 vCPU, 2GB RAM) for this system, follow these instructions on your VPS terminal.

## 1. Create a Swap File
Since t3.small only has 2GB of RAM, heavy usage can cause the system to run out of memory. Creating a 2GB swap file will prevent crashes and slowdowns.

Run these commands one by one on your VPS:

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

## 2. Use PM2 in Cluster Mode
AWS t3.small has **2 vCPUs**. If you run your Node app normally (`node server.js`), it only uses 1 CPU. PM2 can run your app in cluster mode to use **both** CPUs, doubling your capacity.

```bash
# If you don't have PM2 installed globally, install it:
sudo npm install -g pm2

# Start the server using BOTH CPUs
pm2 start server.js -i 2 --name "oms-server"

# Save the PM2 list so it restarts on server reboot
pm2 save
pm2 startup
```

## 3. We Just Added GZIP Compression!
I have modified your code to include `compression`. This compresses the data before sending it to the browser, making the site load much faster.
You will need to pull these changes, install the new dependency, and rebuild:

```bash
npm install
npm run build
pm2 restart oms-server
```

## 4. Database Indexes
If the "All Data" views are loading slowly, it is because MongoDB needs indexes. I noticed you have a script for this. Run it to optimize database lookups:

```bash
node add_indexes.cjs
```
