import { CustomerStatus } from '../types';

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
  }).format(amount);
};

export const getCustomerStatusColor = (status: CustomerStatus) => {
  switch (status) {
    case CustomerStatus.RISK_RED: return 'bg-red-100 text-red-700 border border-red-200';
    case CustomerStatus.RISK_ORANGE: return 'bg-orange-100 text-orange-700 border border-orange-200';
    case CustomerStatus.REGULAR: return 'bg-blue-100 text-blue-700 border border-blue-200';
    default: return 'bg-gray-100 text-gray-600 border border-gray-200';
  }
};

export const parseCSV = (text: string) => {
  const lines = text.split('\n');
  const result = [];
  // Skip header if present (simple check)
  const start = lines[0].toLowerCase().includes('name') ? 1 : 0;
  
  for (let i = start; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Assume CSV: Name,Phone,Address,Product,Price
    const parts = line.split(',');
    if (parts.length >= 3) {
      result.push({
        name: parts[0].trim(),
        phone: parts[1].trim(),
        address: parts.slice(2).join(',').trim() // Handle address with commas
      });
    }
  }
  return result;
};