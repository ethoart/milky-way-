const fs = require('fs');
let content = fs.readFileSync('pages/Dashboard.tsx', 'utf8');

const target = `  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [orderRes, fetchedProducts, fetchedTeam, fetchedStats] = await Promise.all([
          db.getOrders({ tenantId, limit: 10000, startDate, endDate }), 
          db.getProducts(tenantId),
          db.getTeamMembers(tenantId),
          db.getDashboardStats({ tenantId, startDate, endDate })
      ]);
      setGlobalStats(fetchedStats?.stats || null);
      setOrders(orderRes.data || []);
      setProducts(fetchedProducts || []);
      setTeam(fetchedTeam || []);
    } finally { setLoading(false); }
  }, [tenantId, startDate, endDate]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const dashboardData = useMemo(() => {`;

const startIdx = content.indexOf('  const fetchData = useCallback(async () => {');
const endIdx = content.indexOf('return {', startIdx);
const endObjIdx = content.indexOf('};', endIdx) + 2;

if (startIdx !== -1 && endObjIdx !== -1) {
    const originalSection = content.substring(startIdx, endObjIdx);
    const newSection = `
  const [dashboardData, setDashboardData] = useState({
    globalStats: null,
    today: { todayOrders: 0, todayRevenue: 0, todayShippedCount: 0, todayReturnsCount: 0, todayDeliveredCount: 0 },
    inventory: { totalCount: 0, costValue: 0, retailValue: 0 },
    trends: [],
    products: [],
    teamLeaderboard: []
  });

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const fetchedStats = await db.getDashboardStats({ tenantId, startDate, endDate });
      if (fetchedStats) {
          const pStats = fetchedStats.productStats || {};
          const tStats = fetchedStats.teamStats || {};
          const dMap = fetchedStats.dailyMap || {};
          
          const trends = Object.values(dMap);
          const products = Object.values(pStats).map((p: any) => ({
              ...p,
              profit: p.revenue - (p.delivered * (p.buyingPrice || 0)) // simplistic profit
          })).sort((a: any, b: any) => b.salesCount - a.salesCount);
          
          const teamLeaderboard = Object.values(tStats).sort((a: any, b: any) => b.interactions - a.interactions);
          
          setDashboardData({
              globalStats: fetchedStats.stats,
              today: {
                  todayOrders: fetchedStats.todayOrders || 0,
                  todayRevenue: fetchedStats.todayRevenue || 0,
                  todayShippedCount: fetchedStats.todayShippedCount || 0,
                  todayReturnsCount: fetchedStats.todayReturnsCount || 0,
                  todayDeliveredCount: fetchedStats.todayDeliveredCount || 0
              },
              inventory: fetchedStats.inventory || { totalCount: 0, costValue: 0, retailValue: 0 },
              trends,
              products,
              teamLeaderboard
          });
      }
    } finally { setLoading(false); }
  }, [tenantId, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
`;
    content = content.substring(0, startIdx) + newSection + content.substring(endObjIdx);
    // Remove setOrders, setProducts, setTeam, setGlobalStats unused vars
    content = content.replace("const [orders, setOrders] = useState<Order[]>([]);", "");
    content = content.replace("const [globalStats, setGlobalStats] = useState<any>(null);", "");
    content = content.replace("const [products, setProducts] = useState<Product[]>([]);", "");
    content = content.replace("const [team, setTeam] = useState<User[]>([]);", "");
    
    // Fix occurrences of globalStats to dashboardData.globalStats
    content = content.replace(/globalStats/g, "dashboardData.globalStats");
    fs.writeFileSync('pages/Dashboard.tsx', content);
    console.log("Dashboard.tsx updated");
} else {
    console.log("Could not find targets");
}
