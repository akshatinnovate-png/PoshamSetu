// Synthetic pilot district: dates, names, places, destinations, vaccine schedule.
export const NOW = Date.UTC(2026, 10, 17, 3, 30); // 17 Nov 2026, 09:00 IST
export const SIM_START = Date.UTC(2025, 10, 1);
export const SILENT_FROM = Date.UTC(2026, 7, 6);
export const LIVE_FROM = Date.UTC(2026, 9, 1);

export const BLOCKS = [
  { id: 'KHU', name: 'Khuntpani', cdpo: 'Smt. Anita Purty', bmo: 'Dr. R. K. Sinku' },
  { id: 'TON', name: 'Tonto', cdpo: 'Shri Prakash Bodra', bmo: 'Dr. S. Gagrai' },
  { id: 'NOA', name: 'Noamundi', cdpo: 'Smt. Rekha Champia', bmo: 'Dr. M. Laguri' },
];
export const VILLAGES = ['Bara Kuira', 'Sona Pahari', 'Hesadih', 'Jojohatu', 'Rengasai', 'Kundrugutu', 'Sialjoda', 'Barkela', 'Pokam', 'Jamdih', 'Lupungutu', 'Tilaipada',
  'Kasirasai', 'Matkamhatu', 'Gitilpi', 'Dopai', 'Bhoya', 'Herta', 'Purnia', 'Kendposi', 'Bandu', 'Saitba', 'Sarbil', 'Roladih',
  'Kudahatu', 'Nischintpur', 'Kotgarh', 'Murumdih', 'Lagra', 'Dumbisai', 'Nurda', 'Rajabasa', 'Baihatu', 'Dubil', 'Pandrasali', 'Jaipur Tola'];
export const GIRL = ['Somari', 'Budhni', 'Sanika', 'Jyoti', 'Laxmi', 'Gurubari', 'Sombari', 'Mungli', 'Raimuni', 'Sukurmani', 'Phulmani', 'Salge', 'Dumni', 'Pinky', 'Sunita', 'Mainu', 'Juliyani', 'Basanti', 'Chandmuni', 'Anjali', 'Sapna', 'Rani', 'Lilmuni', 'Jasmani'];
export const BOY = ['Birsa', 'Sukru', 'Mangal', 'Budhram', 'Somra', 'Lalit', 'Raju', 'Sanjay', 'Dulal', 'Ravi', 'Gurucharan', 'Jitu', 'Sagen', 'Paltu', 'Lakhan', 'Bijay', 'Mukesh', 'Durga', 'Shiva', 'Ajay', 'Roshan', 'Karan', 'Sonu', 'Turam'];
export const SUR = ['Hembrom', 'Purty', 'Sinku', 'Bodra', 'Tiu', 'Gagrai', 'Champia', 'Banra', 'Laguri', 'Deogam', 'Sundi', 'Kalundia', 'Honhaga', 'Pingua', 'Birua', 'Bage', 'Samad', 'Hansda', 'Tamsoy', 'Jonko'];
export const MOTHER = ['Sukhmati', 'Salomi', 'Parvati', 'Mangri', 'Sita', 'Ranjita', 'Dasmati', 'Rebeka', 'Jema', 'Shanti', 'Kunti', 'Lakhi', 'Marium', 'Pushpa', 'Sumi'];
export const DESTINATIONS = [
  { id: 'BR-PAT', label: 'Brick kilns · Patna, Bihar', state: 'Bihar', kind: 'kiln', awcAvail: 0.55 },
  { id: 'OD-BHD', label: 'Brick kilns · Bhadrak, Odisha', state: 'Odisha', kind: 'kiln', awcAvail: 0.6 },
  { id: 'OD-SBP', label: 'Brick kilns · Sambalpur, Odisha', state: 'Odisha', kind: 'kiln', awcAvail: 0.6 },
  { id: 'PB-LDH', label: 'Brick kilns · Ludhiana, Punjab', state: 'Punjab', kind: 'kiln', awcAvail: 0.45 },
  { id: 'WB-KOL', label: 'Construction · Kolkata, West Bengal', state: 'West Bengal', kind: 'construction', awcAvail: 0.7 },
  { id: 'JH-DHN', label: 'Brick kilns · Dhanbad, Jharkhand', state: 'Jharkhand', kind: 'kiln', awcAvail: 0.8 },
];
/** @type {[string, number][]} */
export const VACCINES = [['BCG', 0], ['Penta-1', 42], ['Penta-2', 70], ['Penta-3', 98], ['MR-1', 274], ['MR-2', 487], ['DPT-B1', 487]];

export function nameFor(r, sex) { return `${r.pick(sex === 'F' ? GIRL : BOY)} ${r.pick(SUR)}`; }
