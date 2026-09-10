const fs = require('fs');
const path = require('path');

const filePath = path.join('f:', 'Absen PILAR', 'absensi-app', 'src', 'app', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add isInitializingAttendance
content = content.replace(
  'const [isLoadingLocation, setIsLoadingLocation] = useState(false);',
  'const [isLoadingLocation, setIsLoadingLocation] = useState(false);\n  const [isInitializingAttendance, setIsInitializingAttendance] = useState(true);'
);

// 2. Set it to false after loading in useEffect
content = content.replace(
  `        if (firebaseData) {`,
  `        if (firebaseData) {`
);

content = content.replace(
  `            } catch (e) {}
          }
        }
      } else {
        setCurrentUser(null);
      }`,
  `            } catch (e) {}
          }
        }
        setIsInitializingAttendance(false);
      } else {
        setCurrentUser(null);
        setIsInitializingAttendance(false);
      }`
);

// 3. Update the buttons to be disabled and grayed out if isInitializingAttendance is true
// Masuk button
content = content.replace(
  `disabled={hasCheckedIn || isLoadingLocation}`,
  `disabled={hasCheckedIn || isLoadingLocation || isInitializingAttendance}`
);

content = content.replace(
  `!hasCheckedIn && !isLoadingLocation
                    ? "bg-pilar-gold text-pilar-darker shadow-neon animate-pulse-gold hover:scale-105 active:scale-95"`,
  `!hasCheckedIn && !isLoadingLocation && !isInitializingAttendance
                    ? "bg-pilar-gold text-pilar-darker shadow-neon animate-pulse-gold hover:scale-105 active:scale-95"`
);

content = content.replace(
  `{isLoadingLocation && !hasCheckedIn ? (`,
  `{(isLoadingLocation || isInitializingAttendance) && !hasCheckedIn ? (`
);

// Pulang button
content = content.replace(
  `disabled={!hasCheckedIn || timeCheckout !== "--:--" || isLoadingLocation}`,
  `disabled={!hasCheckedIn || timeCheckout !== "--:--" || isLoadingLocation || isInitializingAttendance}`
);

content = content.replace(
  `hasCheckedIn && timeCheckout === "--:--" && !isLoadingLocation
                    ? "bg-pilar-gold text-pilar-darker shadow-neon animate-pulse-gold hover:scale-105 active:scale-95"`,
  `hasCheckedIn && timeCheckout === "--:--" && !isLoadingLocation && !isInitializingAttendance
                    ? "bg-pilar-gold text-pilar-darker shadow-neon animate-pulse-gold hover:scale-105 active:scale-95"`
);

content = content.replace(
  `{isLoadingLocation && hasCheckedIn && timeCheckout === "--:--" ? (`,
  `{(isLoadingLocation || isInitializingAttendance) && hasCheckedIn && timeCheckout === "--:--" ? (`
);

// Budi Santoso hardcoded? 
// The name "Budi Santoso" is hardcoded in header! Let's fix that while we are here.
content = content.replace(
  `              <h2 className="text-lg font-bold font-heading text-pilar-textPrimary">
                Budi Santoso
              </h2>`,
  `              <h2 className="text-lg font-bold font-heading text-pilar-textPrimary">
                {currentUser ? currentUser.nama : "Memuat..."}
              </h2>`
);

fs.writeFileSync(filePath, content);
console.log("Refactored page.tsx glitch");
