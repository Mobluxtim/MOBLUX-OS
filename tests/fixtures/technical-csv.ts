// Entirely synthetic records with the real sample's cardinalities; no real customer data.
export const cabinetCsv = Array.from({ length: 21 }, (_, i) => `Synthetic cabinet ${i + 1};1;700;500;400;999.99;999.99`).join('\r\n');
export const cuttingCsv = Array.from({ length: 216 }, (_, i) => [String(i + 1), 'Synthetic project', `Synthetic cabinet ${i % 21 + 1}`, `Synthetic part ${i + 1}`, '698.00', '498.00', i < 64 ? '2' : '1', `Synthetic material ${i % 8}`, '18.00', '-1', 'Synthetic edge', '0.80', '', '', '', '', '', ''].join(';')).join('\r\n');
