const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const targetStr = `if (process.env.NODE_ENV !== "production") {
    import('vite').then(async (vite) => {
        const viteServer = await vite.createServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(viteServer.middlewares);
        app.listen(PORT, "0.0.0.0", () => console.log(\`Dev Server http://localhost:\${PORT}\`));
    });
} else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
    app.listen(PORT, "0.0.0.0", () => console.log(\`Prod Server http://localhost:\${PORT}\`));
}`;

const replaceStr = `const distExists = fs.existsSync(path.join(__dirname, 'dist', 'index.html'));
if (!distExists) {
    import('vite').then(async (vite) => {
        const viteServer = await vite.createServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(viteServer.middlewares);
        app.listen(PORT, "0.0.0.0", () => console.log(\`Dev Server http://localhost:\${PORT}\`));
    });
} else {
    app.use(express.static(path.join(__dirname, 'dist'), { maxAge: '1h' }));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
    app.listen(PORT, "0.0.0.0", () => console.log(\`Prod Server (Dist) http://localhost:\${PORT}\`));
}`;

content = content.replace(targetStr, replaceStr);

if (!content.includes('fs.existsSync')) {
    content = "const fs = require('fs');\n" + content;
}

fs.writeFileSync('server.js', content);
console.log("Updated server to serve dist if available");
