const app = require('./api/index.js');
const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`StepStyle Local Development server running at:`);
    console.log(`  - Main Website: http://localhost:${port}`);
    console.log(`  - Admin Panel:  http://localhost:${port}/admin.html`);
});
