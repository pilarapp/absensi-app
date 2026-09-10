const fs = require('fs');
let c = fs.readFileSync('src/app/pengajuan/page.tsx', 'utf8');

c = c.replace('import DatePicker from "react-datepicker";\nimport "react-datepicker/dist/react-datepicker.css";\nimport { format, parseISO } from "date-fns";\nimport { submitRequest', 'import { submitRequest');

c = c.replace('const [startDate, setStartDate] = useState<Date | null>(null);', 'const [startDate, setStartDate] = useState("");');
c = c.replace('const [endDate, setEndDate] = useState<Date | null>(null);', 'const [endDate, setEndDate] = useState("");');

c = c.replace(/startDate: startDate \? format\(startDate, "yyyy-MM-dd"\) : "",/g, 'startDate: startDate,');
c = c.replace(/endDate: endDate \? format\(endDate, "yyyy-MM-dd"\) : "",/g, 'endDate: endDate,');

c = c.replace(/setStartDate\(null\);/g, 'setStartDate("");');
c = c.replace(/setEndDate\(null\);/g, 'setEndDate("");');

const newStartInput = `<DatePicker selected={startDate} onChange={(date: Date | null) => setStartDate(date)} minDate={new Date()} dateFormat="yyyy-MM-dd" required className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-pilar-gold text-pilar-textPrimary" placeholderText="Pilih tanggal mulai" wrapperClassName="w-full bg-white/5 rounded-lg" />`;
const oldStartInput = `<input \n                    type="date" \n                    required\n                    min={minDateAllowed}\n                    value={startDate}\n                    onChange={(e) => setStartDate(e.target.value)}\n                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-pilar-gold text-pilar-textPrimary"\n                  />`;

const newEndInput = `<DatePicker selected={endDate} onChange={(date: Date | null) => setEndDate(date)} minDate={startDate || new Date()} dateFormat="yyyy-MM-dd" required className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-pilar-gold text-pilar-textPrimary" placeholderText="Pilih tanggal selesai" wrapperClassName="w-full bg-white/5 rounded-lg" />`;
const oldEndInput = `<input \n                    type="date" \n                    required\n                    min={startDate || minDateAllowed}\n                    value={endDate}\n                    onChange={(e) => setEndDate(e.target.value)}\n                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-pilar-gold text-pilar-textPrimary"\n                  />`;

c = c.replace(newStartInput, oldStartInput);
c = c.replace(newEndInput, oldEndInput);

fs.writeFileSync('src/app/pengajuan/page.tsx', c);
