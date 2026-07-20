const fs = require('fs');
let content = fs.readFileSync('services/mockBackend.ts', 'utf8');

const cacheLogic = `
  private async cachedRequest(cacheKey: string, ttlMs: number, fetcher: () => Promise<any>) {
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < ttlMs) {
                return parsed.data;
            }
        }
    } catch(e) {}
    const data = await fetcher();
    try {
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
    } catch(e) {}
    return data;
  }
`;

if (!content.includes('cachedRequest(')) {
    content = content.replace("private async request(", cacheLogic + "\n  private async request(");
}

// update getProducts
content = content.replace(
    /  async getProducts\(tenantId: string\): Promise<Product\[\]> \{\n    return this\.request\('\/products', 'GET', null, \{ tenantId \}\);\n  \}/,
    `  async getProducts(tenantId: string): Promise<Product[]> {
    return this.cachedRequest('cache_products_' + tenantId, 5 * 60 * 1000, () => this.request('/products', 'GET', null, { tenantId }));
  }`
);

// update getTenants
content = content.replace(
    /  async getTenants\(\): Promise<Tenant\[\]> \{\n    return this\.request\('\/tenants', 'GET'\);\n  \}/,
    `  async getTenants(): Promise<Tenant[]> {
    return this.cachedRequest('cache_tenants', 10 * 60 * 1000, () => this.request('/tenants', 'GET'));
  }`
);

// update getGlobalCities
content = content.replace(
    /  async getGlobalCities\(\): Promise<string\[\]> \{\n    const data = await this\.request\('\/cities', 'GET'\);\n    return data\.cities \|\| \[\];\n  \}/,
    `  async getGlobalCities(): Promise<string[]> {
    const data = await this.cachedRequest('cache_cities', 60 * 60 * 1000, () => this.request('/cities', 'GET'));
    return data.cities || [];
  }`
);

// invalidate caches on updates
content = content.replace(/  async updateProduct\(product: Product\): Promise<void> \{/, `  async updateProduct(product: Product): Promise<void> {\n    localStorage.removeItem('cache_products_' + product.tenantId);`);
content = content.replace(/  async deleteProduct\(productId: string, tenantId: string\): Promise<void> \{/, `  async deleteProduct(productId: string, tenantId: string): Promise<void> {\n    localStorage.removeItem('cache_products_' + tenantId);`);
content = content.replace(/  async updateTenant\(tenant: Tenant, adminEmail\?: string, adminPass\?: string\): Promise<void> \{/, `  async updateTenant(tenant: Tenant, adminEmail?: string, adminPass?: string): Promise<void> {\n    localStorage.removeItem('cache_tenants');`);
content = content.replace(/  async updateGlobalCities\(cities: string\[\]\): Promise<void> \{/, `  async updateGlobalCities(cities: string[]): Promise<void> {\n    localStorage.removeItem('cache_cities');`);

fs.writeFileSync('services/mockBackend.ts', content);
console.log("Added frontend caching");
