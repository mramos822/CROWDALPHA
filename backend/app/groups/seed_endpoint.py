"""
API endpoint to seed groups with real users.
Add this as a route in groups/routes.py
"""
from fastapi import APIRouter, HTTPException, Depends
from app.auth.middleware import get_current_user
from app.services.firestore import FirestoreService
from typing import List

router = APIRouter()

@router.post("/seed")
async def seed_groups_endpoint(current_user: dict = Depends(get_current_user)):
    """
    Seed sample groups with real users from database.
    Only accessible to authenticated users.
    """
    try:
        # Get all users from database
        db = FirestoreService.get_firestore_client()
        if not db:
            raise HTTPException(status_code=500, detail="Firestore not initialized")
        
        users_ref = db.collection(FirestoreService.USERS_COLLECTION)
        users = []
        
        for doc in users_ref.limit(20).stream():
            user_data = doc.to_dict()
            if user_data:
                user_data["firebase_uid"] = doc.id
                users.append(user_data)
        
        if len(users) < 3:
            raise HTTPException(status_code=400, detail=f"Need at least 3 users, found {len(users)}")
        
        created_groups = []
        
        # Group 1: AAPL Discussion
        if len(users) >= 8:
            creator_uid = users[0]["firebase_uid"]
            group1 = FirestoreService.create_group(
                creator_uid=creator_uid,
                name="AAPL Discussion",
                description="Discuss Apple stock trends and analysis",
                symbol="AAPL",
                is_private=False,
                max_members=10
            )
            
            for uid in [u["firebase_uid"] for u in users[1:8]]:
                try:
                    FirestoreService.add_member_to_group(group1["id"], uid)
                except:
                    pass  # Already member or full
            
            created_groups.append(group1["id"])
        
        # Group 2: TSLA Bulls (full group)
        if len(users) >= 10:
            creator2_uid = users[1]["firebase_uid"]
            group2 = FirestoreService.create_group(
                creator_uid=creator2_uid,
                name="TSLA Bulls",
                description="Tesla long-term investors group",
                symbol="TSLA",
                is_private=False,
                max_members=10
            )
            
            for uid in [u["firebase_uid"] for u in users if u["firebase_uid"] != creator2_uid][:9]:
                try:
                    FirestoreService.add_member_to_group(group2["id"], uid)
                except:
                    pass
            
            created_groups.append(group2["id"])
        
        # Group 3: NVDA Analysis
        if len(users) >= 6:
            creator3_uid = users[2]["firebase_uid"] if len(users) > 2 else users[0]["firebase_uid"]
            group3 = FirestoreService.create_group(
                creator_uid=creator3_uid,
                name="NVDA Analysis",
                description="NVIDIA technical analysis and earnings discussion",
                symbol="NVDA",
                is_private=True,
                max_members=10
            )
            
            for uid in [u["firebase_uid"] for u in users if u["firebase_uid"] != creator3_uid][:5]:
                try:
                    FirestoreService.add_member_to_group(group3["id"], uid)
                except:
                    pass
            
            created_groups.append(group3["id"])
        
        return {
            "message": f"Successfully seeded {len(created_groups)} groups",
            "group_ids": created_groups,
            "users_count": len(users)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to seed groups: {str(e)}")

