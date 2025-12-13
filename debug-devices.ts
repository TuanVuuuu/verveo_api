import db from './src/config/database.js';
import type { RowDataPacket } from 'mysql2';

async function debugDevices(userId?: number) {
  try {
    if (userId) {
      console.log(`\n🔍 Checking devices for user ${userId}...\n`);
      
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT 
          device_id,
          platform,
          is_active,
          user_id,
          created_at,
          updated_at
         FROM device_tokens 
         WHERE user_id = ? 
         ORDER BY created_at DESC`,
        [userId]
      );
      
      if (rows.length === 0) {
        console.log(`❌ No devices found for user ${userId}`);
        console.log(`\n💡 Possible reasons:`);
        console.log(`   1. User hasn't registered FCM token yet`);
        console.log(`   2. User logged out and device was deleted`);
        console.log(`   3. All devices were deactivated (is_active = FALSE)`);
      } else {
        console.log(`✅ Found ${rows.length} device(s):\n`);
        rows.forEach((row, index) => {
          console.log(`Device ${index + 1}:`);
          console.log(`  - Device ID: ${row.device_id}`);
          console.log(`  - Platform: ${row.platform}`);
          console.log(`  - Active: ${row.is_active ? '✅ YES' : '❌ NO'}`);
          console.log(`  - Created: ${row.created_at}`);
          console.log(`  - Updated: ${row.updated_at}`);
          console.log('');
        });
        
        const activeCount = rows.filter(r => r.is_active).length;
        if (activeCount === 0) {
          console.log(`⚠️  WARNING: User has ${rows.length} device(s) but ALL are inactive!`);
        }
      }
    } else {
      console.log(`\n📊 All active devices in system:\n`);
      
      const [rows] = await db.query<RowDataPacket[]>(
        `SELECT 
          user_id,
          device_id,
          platform,
          is_active,
          created_at
         FROM device_tokens 
         WHERE is_active = TRUE
         ORDER BY user_id, created_at DESC`
      );
      
      if (rows.length === 0) {
        console.log(`❌ No active devices found in system`);
      } else {
        console.log(`✅ Found ${rows.length} active device(s):\n`);
        rows.forEach((row, index) => {
          console.log(`Device ${index + 1}:`);
          console.log(`  - User ID: ${row.user_id}`);
          console.log(`  - Device ID: ${row.device_id}`);
          console.log(`  - Platform: ${row.platform}`);
          console.log(`  - Created: ${row.created_at}`);
          console.log('');
        });
      }
    }
    
    await db.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    await db.end();
    process.exit(1);
  }
}

const userId = process.argv[2] ? parseInt(process.argv[2]) : undefined;
debugDevices(userId);

