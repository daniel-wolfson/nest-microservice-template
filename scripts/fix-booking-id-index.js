// Fix duplicate key error by dropping old bookingId index
// Run: docker exec -i <mongo-container> mongosh < scripts/fix-booking-id-index.js

db = db.getSiblingDB('microservice-template-billing-test');

print('Current indexes:');
printjson(db.travel_booking_saga_states.getIndexes());

print('\nDropping old bookingId_1 index...');
try {
    db.travel_booking_saga_states.dropIndex('bookingId_1');
    print('✅ Successfully dropped bookingId_1 index');
} catch (e) {
    print('⚠️ Error dropping index (it may not exist):', e.message);
}

print('\nNew indexes will be created automatically when app starts');
print('New bookingId index will have { unique: true, sparse: true }');
