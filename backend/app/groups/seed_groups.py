"""
Script to seed initial groups with real users from the database.
Run this to create sample groups populated with actual users from Firestore.
"""
from app.services.firestore import FirestoreService
from typing import List

def get_all_users(limit: int = 20) -> List[dict]:
    """Get all users from the database"""
    db = FirestoreService.get_firestore_client()
    if not db:
        raise ValueError("Firestore not initialized")
    
    users_ref = db.collection(FirestoreService.USERS_COLLECTION)
    users = []
    
    for doc in users_ref.limit(limit).stream():
        user_data = doc.to_dict()
        if user_data:
            user_data["firebase_uid"] = doc.id
            users.append(user_data)
    
    return users

def seed_groups():
    """Create sample groups with real users"""
    try:
        # Get all users from database
        users = get_all_users()
        
        if len(users) < 3:
            print(f"⚠️  Need at least 3 users in database, found {len(users)}")
            print("Please create some users first.")
            return
        
        print(f"✅ Found {len(users)} users in database")
        
        # Get creator (first user)
        creator = users[0]
        creator_uid = creator["firebase_uid"]
        
        # Group 1: AAPL Discussion - add first 8 users
        if len(users) >= 8:
            group1 = FirestoreService.create_group(
                creator_uid=creator_uid,
                name="AAPL Discussion",
                description="Discuss Apple stock trends and analysis",
                symbol="AAPL",
                is_private=False,
                max_members=10
            )
            
            # Add members (creator is already added)
            member_uids = [u["firebase_uid"] for u in users[1:8]]  # 7 more users
            for uid in member_uids:
                try:
                    FirestoreService.add_member_to_group(group1["id"], uid)
                except Exception as e:
                    print(f"  ⚠️  Could not add member {uid}: {e}")
            
            print(f"✅ Created group: {group1['name']} (ID: {group1['id']}) with {len(member_uids) + 1} members")
        
        # Group 2: TSLA Bulls - add next 9 users (total 10 including creator)
        if len(users) >= 10:
            # Use a different creator for variety
            creator2_uid = users[1]["firebase_uid"]
            group2 = FirestoreService.create_group(
                creator_uid=creator2_uid,
                name="TSLA Bulls",
                description="Tesla long-term investors group",
                symbol="TSLA",
                is_private=False,
                max_members=10
            )
            
            # Add members - skip creator2, include others up to 10 total
            member_uids = [u["firebase_uid"] for u in users if u["firebase_uid"] != creator2_uid][:9]
            for uid in member_uids:
                try:
                    FirestoreService.add_member_to_group(group2["id"], uid)
                except Exception as e:
                    print(f"  ⚠️  Could not add member {uid}: {e}")
            
            print(f"✅ Created group: {group2['name']} (ID: {group2['id']}) with {len(member_uids) + 1} members (FULL)")
        
        # Group 3: NVDA Analysis - add next 5 users (total 6)
        if len(users) >= 6:
            # Use a different creator
            creator3_uid = users[2]["firebase_uid"] if len(users) > 2 else creator_uid
            group3 = FirestoreService.create_group(
                creator_uid=creator3_uid,
                name="NVDA Analysis",
                description="NVIDIA technical analysis and earnings discussion",
                symbol="NVDA",
                is_private=True,
                max_members=10
            )
            
            # Add members - use different users
            member_uids = [u["firebase_uid"] for u in users if u["firebase_uid"] != creator3_uid][:5]
            for uid in member_uids:
                try:
                    FirestoreService.add_member_to_group(group3["id"], uid)
                except Exception as e:
                    print(f"  ⚠️  Could not add member {uid}: {e}")
            
            print(f"✅ Created group: {group3['name']} (ID: {group3['id']}) with {len(member_uids) + 1} members")
        
        print("\n✅ Group seeding completed!")
        
    except Exception as e:
        print(f"❌ Error seeding groups: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    seed_groups()

