// Migration script to fix existing match data
// Run this once to update your matches to the new format

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, getDocs, writeBatch } = require('firebase/firestore');

// Your Firebase config (make sure this matches your project)
const firebaseConfig = {
  // Add your Firebase config here
  // You can find this in your Firebase console
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateMatches() {
  try {
    console.log('🔄 Starting match migration...');
    
    const allMatchesQuery = query(collection(db, 'matches'));
    const snapshot = await getDocs(allMatchesQuery);
    
    console.log(`📊 Found ${snapshot.size} total matches`);
    
    const batch = writeBatch(db);
    let updatedCount = 0;
    
    snapshot.forEach((matchDoc) => {
      const matchData = matchDoc.data();
      
      // Check if match needs migration
      const needsMigration = (
        matchData.isActive === undefined || 
        (!matchData.lastMessage && !matchData.lastMessageAt)
      );
      
      if (needsMigration) {
        const updates = {};
        
        // Add isActive field if missing
        if (matchData.isActive === undefined) {
          updates.isActive = true;
          console.log(`✅ Adding isActive=true to match ${matchDoc.id}`);
        }
        
        // Add lastMessage field if missing
        if (!matchData.lastMessage && !matchData.lastMessageAt) {
          updates.lastMessage = matchData.createdAt || new Date();
          console.log(`✅ Adding lastMessage to match ${matchDoc.id}`);
        } else if (matchData.lastMessageAt && !matchData.lastMessage) {
          updates.lastMessage = matchData.lastMessageAt;
          console.log(`✅ Converting lastMessageAt to lastMessage for match ${matchDoc.id}`);
        }
        
        batch.update(matchDoc.ref, updates);
        updatedCount++;
      }
    });
    
    if (updatedCount > 0) {
      await batch.commit();
      console.log(`🎉 Migration complete: Updated ${updatedCount} match documents`);
    } else {
      console.log('✅ No matches needed migration - all up to date!');
    }
    
  } catch (error) {
    console.error('❌ Error migrating matches:', error);
  }
}

// Run the migration
migrateMatches().then(() => {
  console.log('Migration script finished');
  process.exit(0);
}).catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
}); 