const fs = require('fs');
let c = fs.readFileSync('src/app/admin/page.tsx', 'utf8');

c = c.replace('import { subscribeToRequests, updateRequestStatus } from "@/lib/db";\nimport DatePicker from "react-datepicker";\nimport "react-datepicker/dist/react-datepicker.css";', 'import { subscribeToRequests, updateRequestStatus } from "@/lib/db";');

const newMonthInput = `<DatePicker selected={new Date()} onChange={(d) => {}} showMonthYearPicker dateFormat="MM/yyyy" className="w-full md:w-auto border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all" />`;
const oldMonthInput = `<input type="month" className="w-full md:w-auto border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-pilar-darker focus:ring-1 focus:ring-pilar-darker shadow-sm transition-all" />`;

c = c.replace(newMonthInput, oldMonthInput);

fs.writeFileSync('src/app/admin/page.tsx', c);
