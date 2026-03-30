import fs from 'fs';
import yaml from 'js-yaml';

// Read YAML
const yamlContent = fs.readFileSync('openapi.yaml', 'utf8');

// Convert to JSON
const jsonObj = yaml.load(yamlContent);

// Write JSON
const jsonContent = JSON.stringify(jsonObj, null, 2);
fs.writeFileSync('public/openapi.json', jsonContent);

console.log(`Converted openapi.yaml to public/openapi.json (${jsonContent.length} chars)`);
