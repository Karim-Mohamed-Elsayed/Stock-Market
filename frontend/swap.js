const fs = require('fs');
const content = fs.readFileSync('d:/Projects/Depi_project/frontend/src/app/insights/page.tsx', 'utf8');

// Find the grid section
const gridStart = content.indexOf(`      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>`);

// Find the analytics section
const analyticsStart = content.indexOf(`      {/* --- Analytics Dashboards Section --- */}`);

// The analytics section ends at line 804, right before `    </main>`
const analyticsEnd = content.lastIndexOf(`    </main>`);

const gridSection = content.substring(gridStart, analyticsStart);
const analyticsSection = content.substring(analyticsStart, analyticsEnd);

// Modify the borders and margins for proper visual flow
const newAnalyticsSection = analyticsSection.replace(
  `marginTop: '80px', paddingTop: '64px', borderTop: '1px solid var(--border)'`,
  `marginBottom: '80px', paddingBottom: '64px', borderBottom: '1px solid var(--border)'`
);

const newGridSection = gridSection.trimEnd() + '\n';

const newContent = content.substring(0, gridStart) + newAnalyticsSection + newGridSection + '    </main>\n  );\n}\n';

fs.writeFileSync('d:/Projects/Depi_project/frontend/src/app/insights/page.tsx', newContent);
console.log("Successfully swapped sections");
