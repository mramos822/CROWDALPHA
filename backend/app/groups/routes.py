from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from app.auth.middleware import get_current_user
from app.services.firestore import FirestoreService
from app.schemas.groups import GroupCreate, GroupResponse, MemberResponse, InvitationRequest, UserSearchResponse
from app.schemas.messages import MessageCreate, MessageResponse

router = APIRouter(prefix="/api/groups", tags=["Groups"])

@router.get("/", response_model=List[GroupResponse])
async def get_groups(
    user_uid: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all groups (public groups or user's groups)"""
    try:
        # Use current user's UID if provided, otherwise get all public groups
        uid = user_uid or current_user.get("firebase_uid")
        groups = FirestoreService.get_groups(user_uid=uid)
        return groups
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error fetching groups: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch groups")

@router.get("/my-groups", response_model=List[GroupResponse])
async def get_my_groups(
    as_creator: bool = Query(False, description="Filter to groups where user is creator"),
    current_user: dict = Depends(get_current_user)
):
    """Get groups where current user is a member or creator"""
    try:
        user_uid = current_user.get("firebase_uid")
        if not user_uid:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        groups = FirestoreService.get_user_groups(user_uid, as_creator=as_creator)
        return groups
    except Exception as e:
        print(f"Error fetching user groups: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch groups")

@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific group by ID"""
    try:
        group = FirestoreService.get_group(group_id)
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # Check if user can access (public or member)
        if group.get("is_private") and current_user.get("firebase_uid") not in group.get("members", []):
            raise HTTPException(status_code=403, detail="Access denied: This is a private group")
        
        return group
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching group: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch group")

@router.get("/{group_id}/members", response_model=List[MemberResponse])
async def get_group_members(
    group_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get members of a group"""
    try:
        group = FirestoreService.get_group(group_id)
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        # Check access
        if group.get("is_private") and current_user.get("firebase_uid") not in group.get("members", []):
            raise HTTPException(status_code=403, detail="Access denied")
        
        members = FirestoreService.get_group_members(group_id)
        return members
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching group members: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch group members")

@router.post("/", response_model=GroupResponse)
async def create_group(
    group_data: GroupCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new group"""
    try:
        creator_uid = current_user.get("firebase_uid")
        if not creator_uid:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        # Create the group
        group = FirestoreService.create_group(
            creator_uid=creator_uid,
            name=group_data.name,
            description=group_data.description,
            symbol=group_data.symbol,
            is_private=group_data.is_private,
            max_members=group_data.max_members
        )
        
        # Send invitations to usernames if provided
        if group_data.invite_usernames:
            for username in group_data.invite_usernames:
                try:
                    FirestoreService.create_invitation(
                        group_id=group["id"],
                        inviter_uid=creator_uid,
                        invitee_username=username
                    )
                except ValueError as e:
                    # Log error but don't fail group creation
                    print(f"Failed to invite {username}: {e}")
        
        return group
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error creating group: {e}")
        raise HTTPException(status_code=500, detail="Failed to create group")

@router.post("/{group_id}/invite", response_model=dict)
async def invite_user(
    group_id: str,
    invitation: InvitationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Invite a user to join a group"""
    try:
        inviter_uid = current_user.get("firebase_uid")
        if not inviter_uid:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        # Check if user is a member/creator of the group
        group = FirestoreService.get_group(group_id)
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        if inviter_uid not in group.get("members", []):
            raise HTTPException(status_code=403, detail="Only group members can send invitations")
        
        # Create invitation
        invitation_data = FirestoreService.create_invitation(
            group_id=group_id,
            inviter_uid=inviter_uid,
            invitee_username=invitation.username
        )
        
        return {
            "message": f"Invitation sent to {invitation.username}",
            "invitation": invitation_data
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error creating invitation: {e}")
        raise HTTPException(status_code=500, detail="Failed to send invitation")

@router.get("/users/search", response_model=List[UserSearchResponse])
async def search_users(
    q: str = Query(..., description="Username search query"),
    current_user: dict = Depends(get_current_user)
):
    """Search users by username"""
    try:
        if len(q) < 1:
            return []
        
        users = FirestoreService.search_users_by_username(q, limit=10)
        
        # Format response
        results = []
        for user in users:
            avatar = ""
            if user.get("first_name"):
                avatar += user["first_name"][0]
            if user.get("last_name"):
                avatar += user["last_name"][0]
            
            results.append(UserSearchResponse(
                firebase_uid=user.get("firebase_uid", ""),
                username=user.get("username", ""),
                first_name=user.get("first_name", ""),
                last_name=user.get("last_name", ""),
                email=user.get("email", ""),
                avatar=avatar if avatar else None
            ))
        
        return results
    except Exception as e:
        print(f"Error searching users: {e}")
        raise HTTPException(status_code=500, detail="Failed to search users")

@router.post("/{group_id}/join")
async def join_group(
    group_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Join a public group"""
    try:
        user_uid = current_user.get("firebase_uid")
        if not user_uid:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        group = FirestoreService.add_member_to_group(group_id, user_uid)
        return {
            "message": "Successfully joined group",
            "group": group
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error joining group: {e}")
        raise HTTPException(status_code=500, detail="Failed to join group")

@router.post("/seed")
async def seed_groups(
    current_user: dict = Depends(get_current_user)
):
    """Seed sample groups with real users from database"""
    try:
        # Get all users from database
        from app.services.firestore import get_firestore_client
        db = get_firestore_client()
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
            
            member_uids = [u["firebase_uid"] for u in users if u["firebase_uid"] != creator2_uid][:9]
            for uid in member_uids:
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
            
            member_uids = [u["firebase_uid"] for u in users if u["firebase_uid"] != creator3_uid][:5]
            for uid in member_uids:
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
        print(f"Error seeding groups: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to seed groups: {str(e)}")

@router.delete("/{group_id}/members/{member_uid}")
async def remove_member(
    group_id: str,
    member_uid: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove a member from a group"""
    try:
        remover_uid = current_user.get("firebase_uid")
        if not remover_uid:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        group = FirestoreService.remove_member_from_group(group_id, member_uid, remover_uid)
        return {"message": "Member removed successfully", "group": group}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error removing member: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove member")

@router.delete("/{group_id}")
async def delete_group(
    group_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a group (only creator can do this)"""
    try:
        user_uid = current_user.get("firebase_uid")
        if not user_uid:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        FirestoreService.delete_group(group_id, user_uid)
        return {"message": "Group deleted successfully"}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error deleting group: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete group")

@router.post("/{group_id}/messages", response_model=MessageResponse)
async def create_message(
    group_id: str,
    message: MessageCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a message in a group"""
    try:
        sender_uid = current_user.get("firebase_uid")
        if not sender_uid:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        # Extract mentions and stock symbols from content
        import re
        mentions = re.findall(r'@(\w+)', message.content)
        stock_symbols = re.findall(r'\$([A-Z]{1,5})', message.content)
        
        created_message = FirestoreService.create_message(
            group_id=group_id,
            sender_uid=sender_uid,
            content=message.content,
            mentions=list(set(mentions + (message.mentions or []))),
            stock_symbols=list(set(stock_symbols + (message.stock_symbols or [])))
        )
        
        return created_message
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error creating message: {e}")
        raise HTTPException(status_code=500, detail="Failed to create message")

@router.get("/{group_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    group_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get messages for a group"""
    try:
        user_uid = current_user.get("firebase_uid")
        if not user_uid:
            raise HTTPException(status_code=401, detail="User not authenticated")
        
        # Check if user is a member
        group = FirestoreService.get_group(group_id)
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        if user_uid not in group.get("members", []):
            raise HTTPException(status_code=403, detail="Only group members can view messages")
        
        messages = FirestoreService.get_group_messages(group_id, limit=limit)
        return messages
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching messages: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch messages")

