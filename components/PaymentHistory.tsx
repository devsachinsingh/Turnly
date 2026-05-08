'use client';

import type { PaymentRecord } from '@/lib/types';

interface PaymentHistoryProps {
  history: PaymentRecord[];
}

export function PaymentHistory({ history }: PaymentHistoryProps) {
  const sorted = [...history].sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
  );

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Payment History</h3>

      {history.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No payments recorded yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b-2 border-gray-200">
              <tr>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Who</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Amount</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Date</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((record) => (
                <tr key={record.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-3 font-semibold text-gray-900">{record.memberName}</td>
                  <td className="py-3 px-3 text-green-700 font-medium">₹{record.amount.toFixed(2)}</td>
                  <td className="py-3 px-3 text-gray-600">
                    {new Date(record.paidAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-3 text-gray-600">{record.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
