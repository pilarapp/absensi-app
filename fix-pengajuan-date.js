const fs = require('fs');

let c = fs.readFileSync('src/app/pengajuan/page.tsx', 'utf8');

c = c.replace('import { submitRequest', `import DatePicker from "react-datepicker";\nimport "react-datepicker/dist/react-datepicker.css";\nimport { format, parseISO } from "date-fns";\nimport { submitRequest`);

c = c.replace('const [startDate, setStartDate] = useState("");', 'const [startDate, setStartDate] = useState<Date | null>(null);');
c = c.replace('const [endDate, setEndDate] = useState("");', 'const [endDate, setEndDate] = useState<Date | null>(null);');

c = c.replace(/startDate: startDate,/g, 'startDate: startDate ? format(startDate, "yyyy-MM-dd") : "",');
c = c.replace(/endDate: endDate,/g, 'endDate: endDate ? format(endDate, "yyyy-MM-dd") : "",');

c = c.replace(/setStartDate\(""\);/g, 'setStartDate(null);');
c = c.replace(/setEndDate\(""\);/g, 'setEndDate(null);');

const oldStartInput = `<input \n                    type="date" \n                    required\n                    min={minDateAllowed}\n                    value={startDate}\n                    onChange={(e) => setStartDate(e.target.value)}\n                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-pilar-gold text-pilar-textPrimary"\n                  />`;
const newStartInput = `<DatePicker selected={startDate} onChange={(date: Date | null) => setStartDate(date)} minDate={new Date()} dateFormat="yyyy-MM-dd" required className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-pilar-gold text-pilar-textPrimary" placeholderText="Pilih tanggal mulai" wrapperClassName="w-full bg-white/5 rounded-lg" />`;

const oldEndInput = `<input \n                    type="date" \n                    required\n                    min={startDate || minDateAllowed}\n                    value={endDate}\n                    onChange={(e) => setEndDate(e.target.value)}\n                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-pilar-gold text-pilar-textPrimary"\n                  />`;
const newEndInput = `<DatePicker selected={endDate} onChange={(date: Date | null) => setEndDate(date)} minDate={startDate || new Date()} dateFormat="yyyy-MM-dd" required className="w-full bg-transparent border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-pilar-gold text-pilar-textPrimary" placeholderText="Pilih tanggal selesai" wrapperClassName="w-full bg-white/5 rounded-lg" />`;

c = c.replace(oldStartInput, newStartInput);
c = c.replace(oldEndInput, newEndInput);

fs.writeFileSync('src/app/pengajuan/page.tsx', c);
