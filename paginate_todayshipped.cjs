const fs = require('fs');
let content = fs.readFileSync('pages/TodayShipped.tsx', 'utf8');

if (!content.includes('currentPage')) {
    content = content.replace(
        "const [targetDate, setTargetDate] = useState(getSLDateString());",
        "const [targetDate, setTargetDate] = useState(getSLDateString());\n  const [currentPage, setCurrentPage] = useState(1);\n  const limit = 50;"
    );

    content = content.replace(
        "const filtered = orders.filter(o => {",
        "setCurrentPage(1);\n    const filtered = orders.filter(o => {"
    );

    content = content.replace(
        ") : dailyOrders.map(o => {",
        ") : dailyOrders.slice((currentPage - 1) * limit, currentPage * limit).map(o => {"
    );

    const paginationControls = `
                </tbody>
              </table>
            </div>
            {dailyOrders.length > limit && (
                <div className="flex items-center justify-between p-6 border-t border-slate-100 bg-slate-50 rounded-b-3xl">
                    <p className="text-xs font-bold text-slate-500">
                        Showing {(currentPage - 1) * limit + 1} to {Math.min(currentPage * limit, dailyOrders.length)} of {dailyOrders.length} items
                    </p>
                    <div className="flex gap-2">
                        <button 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button 
                            disabled={currentPage * limit >= dailyOrders.length}
                            onClick={() => setCurrentPage(prev => prev + 1)}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    `;
    
    content = content.replace(
        /<\/tbody>\s*<\/table>\s*<\/div>\s*<\/div>/g,
        paginationControls
    );

    fs.writeFileSync('pages/TodayShipped.tsx', content);
    console.log("TodayShipped paginated");
}
