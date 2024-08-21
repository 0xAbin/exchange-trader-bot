import * as fs from 'fs';
import * as path from 'path';

export const saveJsonToFile = (filePath: string, data: any) => {
    try {
        // Ensure the directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`✅ Data saved to ${filePath}`);
    } catch (error) {
        console.error(`❌ Failed to save data to ${filePath}:`, error);
    }
};