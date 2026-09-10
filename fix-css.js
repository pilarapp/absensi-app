const fs = require('fs');
let c = fs.readFileSync('src/app/globals.css', 'utf8');

// Find the @page block to truncate the corrupt appended text
const goodPart = c.substring(0, c.indexOf('@page {') + 33);

const newCSS = `
/* Custom React DatePicker Styles */
.react-datepicker {
  background-color: var(--color-pilar-darker) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  font-family: var(--font-jakarta), sans-serif !important;
  border-radius: 12px !important;
  color: var(--color-pilar-textPrimary) !important;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5) !important;
}
.react-datepicker__header {
  background-color: var(--color-pilar-dark) !important;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
  border-top-left-radius: 12px !important;
  border-top-right-radius: 12px !important;
}
.react-datepicker__current-month, 
.react-datepicker-time__header, 
.react-datepicker-year-header {
  color: var(--color-pilar-gold) !important;
  font-weight: 700 !important;
}
.react-datepicker__day-name {
  color: var(--color-pilar-textSecondary) !important;
}
.react-datepicker__day {
  color: var(--color-pilar-textPrimary) !important;
}
.react-datepicker__day:hover, .react-datepicker__month-text:hover, .react-datepicker__year-text:hover {
  background-color: rgba(212, 175, 55, 0.2) !important;
  border-radius: 6px !important;
}
.react-datepicker__day--selected, .react-datepicker__month-text--selected, .react-datepicker__year-text--selected {
  background-color: var(--color-pilar-gold) !important;
  color: var(--color-pilar-darker) !important;
  font-weight: bold !important;
  border-radius: 6px !important;
}
.react-datepicker__triangle {
  display: none !important;
}
.react-datepicker__navigation-icon::before {
  border-color: var(--color-pilar-textSecondary) !important;
}
.react-datepicker__navigation:hover *::before {
  border-color: var(--color-pilar-gold) !important;
}
.react-datepicker-wrapper {
  width: 100%;
}
`;

fs.writeFileSync('src/app/globals.css', goodPart + newCSS);
