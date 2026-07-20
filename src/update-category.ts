import fs from 'fs';
import path from 'path';

interface IconEntry {
    name: string;
    target: string;
    type: string;
}

// Get all directories in the current folder (excluding hidden ones, node_modules, and src)
const dirs: string[] = fs.readdirSync('.').filter(f => fs.statSync(f).isDirectory() && !f.startsWith('.') && f !== 'node_modules' && f !== 'src');

for (const category of dirs) {
    const files: string[] = fs.readdirSync(category).filter(f => f.endsWith('.json'));

    if (files.length === 0) continue;

    // Generate the JSON array based on files in the category directory
    const result: IconEntry[] = files.map(file => {
        const name = path.basename(file, '.json');
        return {
            name: name,
            target: `${category}/${file}`,
            type: category
        };
    });

    fs.writeFileSync(`${category}.json`, JSON.stringify(result, null, 2) + '\n');
    console.log(`Updated ${category}.json with ${result.length} items.`);
}
