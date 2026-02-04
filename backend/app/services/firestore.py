from firebase_admin import firestore
from datetime import datetime
from typing import Optional, Dict, Any, List, List

# Initialize Firestore - get client lazily to ensure Firebase Admin is initialized first
db = None

def get_firestore_client():
    """Get Firestore client, initializing if needed"""
    global db
    if db is None:
        try:
            # Import firebase_admin to ensure it's initialized
            import firebase_admin
            if firebase_admin._apps:
                db = firestore.client()
                print("DEBUG: ✅ Firestore client initialized successfully")
            else:
                print("DEBUG: ⚠️ Firebase Admin not initialized, Firestore unavailable")
        except Exception as e:
            print(f"DEBUG: ⚠️ Firestore initialization failed: {e}")
            db = None
    return db

class FirestoreService:
    USERS_COLLECTION = "users"
    GROUPS_COLLECTION = "groups"
    INVITATIONS_COLLECTION = "group_invitations"
    MESSAGES_COLLECTION = "group_messages"
    IPOS_COLLECTION = "ipos"
    
    @staticmethod
    def create_user_profile(
        firebase_uid: str,
        email: str,
        first_name: str,
        last_name: str,
        username: str
    ) -> Dict[str, Any]:
        """Create a new user profile in Firestore"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
            
        user_data = {
            "firebase_uid": firebase_uid,  # Add this for response
            "first_name": first_name,
            "last_name": last_name,
            "username": username,
            "email": email,
            "plan_tier": "free",  # Default to free
            "joined_at": datetime.utcnow(),
            "last_login": datetime.utcnow()
        }
        
        # Store in Firestore with firebase_uid as document ID
        db.collection(FirestoreService.USERS_COLLECTION).document(firebase_uid).set(user_data)
        
        return user_data
    
    @staticmethod
    def get_user_profile(firebase_uid: str) -> Optional[Dict[str, Any]]:
        """Get user profile from Firestore"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
            
        doc_ref = db.collection(FirestoreService.USERS_COLLECTION).document(firebase_uid)
        doc = doc_ref.get()
        
        if doc.exists:
            user_data = doc.to_dict()
            # Convert datetime objects to ISO format strings for JSON serialization
            if user_data:
                for key, value in user_data.items():
                    if hasattr(value, 'isoformat'):  # datetime or timestamp objects
                        user_data[key] = value.isoformat()
                    elif hasattr(value, 'timestamp'):  # Firestore Timestamp
                        user_data[key] = value.to_datetime().isoformat()
            return user_data
        return None
    
    @staticmethod
    def update_user_profile(firebase_uid: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update user profile in Firestore"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
            
        doc_ref = db.collection(FirestoreService.USERS_COLLECTION).document(firebase_uid)
        
        # Update the document
        doc_ref.update(update_data)
        
        # Return updated profile
        return FirestoreService.get_user_profile(firebase_uid)
    
    @staticmethod
    def check_username_exists(username: str) -> bool:
        """Check if username already exists"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
            
        users_ref = db.collection(FirestoreService.USERS_COLLECTION)
        query = users_ref.where("username", "==", username).limit(1)
        
        results = query.get()
        return len(results) > 0
    
    @staticmethod
    def check_email_exists(email: str) -> bool:
        """Check if email already exists in Firestore"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        users_ref = db.collection(FirestoreService.USERS_COLLECTION)
        query = users_ref.where("email", "==", email).limit(1)
        
        results = query.get()
        return len(results) > 0
    
    @staticmethod
    def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
        """Get user profile by email address"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        users_ref = db.collection(FirestoreService.USERS_COLLECTION)
        query = users_ref.where("email", "==", email).limit(1)
        
        results = query.get()
        if len(results) > 0:
            user_data = results[0].to_dict()
            if user_data:
                # Convert datetime objects to ISO format strings
                for key, value in user_data.items():
                    if hasattr(value, 'isoformat'):
                        user_data[key] = value.isoformat()
                    elif hasattr(value, 'timestamp'):
                        user_data[key] = value.to_datetime().isoformat()
            return user_data
        return None

    @staticmethod
    def update_last_login(firebase_uid: str):
        """Update user's last login timestamp"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
            
        from datetime import datetime
        doc_ref = db.collection(FirestoreService.USERS_COLLECTION).document(firebase_uid)
        doc_ref.update({"last_login": datetime.utcnow()})
    
    @staticmethod
    def search_users_by_username(username_query: str, limit: int = 10) -> list[Dict[str, Any]]:
        """Search users by username (case-insensitive partial match)"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        users_ref = db.collection(FirestoreService.USERS_COLLECTION)
        # Note: Firestore doesn't support case-insensitive search directly
        # We'll get all users and filter in Python (for small datasets)
        # For production, consider using Algolia or similar for full-text search
        all_users = users_ref.limit(100).stream()  # Limit to prevent performance issues
        
        results = []
        username_lower = username_query.lower()
        
        for doc in all_users:
            user_data = doc.to_dict()
            if user_data and user_data.get("username", "").lower().startswith(username_lower):
                user_data["firebase_uid"] = doc.id
                # Convert datetime objects
                for key, value in user_data.items():
                    if hasattr(value, 'isoformat'):
                        user_data[key] = value.isoformat()
                    elif hasattr(value, 'timestamp'):
                        user_data[key] = value.to_datetime().isoformat()
                results.append(user_data)
                if len(results) >= limit:
                    break
        
        return results
    
    @staticmethod
    def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
        """Get user by exact username"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        users_ref = db.collection(FirestoreService.USERS_COLLECTION)
        query = users_ref.where("username", "==", username).limit(1)
        
        results = query.get()
        if results:
            doc = results[0]
            user_data = doc.to_dict()
            if user_data:
                user_data["firebase_uid"] = doc.id
                # Convert datetime objects
                for key, value in user_data.items():
                    if hasattr(value, 'isoformat'):
                        user_data[key] = value.isoformat()
                    elif hasattr(value, 'timestamp'):
                        user_data[key] = value.to_datetime().isoformat()
                return user_data
        return None
    
    @staticmethod
    def create_group(
        creator_uid: str,
        name: str,
        description: str,
        symbol: Optional[str] = None,
        is_private: bool = False,
        max_members: int = 10
    ) -> Dict[str, Any]:
        """Create a new group"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        group_data = {
            "name": name,
            "description": description,
            "symbol": symbol or name.split()[0].upper() if name else "GEN",
            "creator_uid": creator_uid,
            "is_private": is_private,
            "max_members": max_members,
            "member_count": 1,  # Creator is first member
            "members": [creator_uid],  # List of member UIDs
            "created_at": datetime.utcnow(),
            "last_activity": datetime.utcnow()
        }
        
        # Create group document
        doc_ref = db.collection(FirestoreService.GROUPS_COLLECTION).document()
        doc_ref.set(group_data)
        
        group_data["id"] = doc_ref.id
        # Convert datetime
        for key, value in group_data.items():
            if hasattr(value, 'isoformat'):
                group_data[key] = value.isoformat()
            elif hasattr(value, 'timestamp'):
                group_data[key] = value.to_datetime().isoformat()
        
        return group_data
    
    @staticmethod
    def get_groups(user_uid: Optional[str] = None, limit: int = 50) -> list[Dict[str, Any]]:
        """Get all groups (or groups user is member of)"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        groups_ref = db.collection(FirestoreService.GROUPS_COLLECTION)
        
        if user_uid:
            # Get groups where user is a member
            query = groups_ref.where("members", "array_contains", user_uid).limit(limit)
        else:
            # Get all public groups (no order_by to avoid index requirement)
            query = groups_ref.where("is_private", "==", False).limit(limit)
        
        groups = []
        for doc in query.stream():
            group_data = doc.to_dict()
            if group_data:
                group_data["id"] = doc.id
                # Convert datetime objects
                for key, value in group_data.items():
                    if hasattr(value, 'isoformat'):
                        group_data[key] = value.isoformat()
                    elif hasattr(value, 'timestamp'):
                        group_data[key] = value.to_datetime().isoformat()
                groups.append(group_data)
        
        return groups
    
    @staticmethod
    def get_group(group_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific group by ID"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        doc_ref = db.collection(FirestoreService.GROUPS_COLLECTION).document(group_id)
        doc = doc_ref.get()
        
        if doc.exists:
            group_data = doc.to_dict()
            if group_data:
                group_data["id"] = doc.id
                # Convert datetime objects
                for key, value in group_data.items():
                    if hasattr(value, 'isoformat'):
                        group_data[key] = value.isoformat()
                    elif hasattr(value, 'timestamp'):
                        group_data[key] = value.to_datetime().isoformat()
                return group_data
        return None
    
    @staticmethod
    def get_group_members(group_id: str) -> list[Dict[str, Any]]:
        """Get member details for a group"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        group = FirestoreService.get_group(group_id)
        if not group or "members" not in group:
            return []
        
        member_uids = group["members"]
        members = []
        
        for uid in member_uids:
            user_profile = FirestoreService.get_user_profile(uid)
            if user_profile:
                # Format member data
                member_data = {
                    "firebase_uid": uid,
                    "username": user_profile.get("username", ""),
                    "first_name": user_profile.get("first_name", ""),
                    "last_name": user_profile.get("last_name", ""),
                    "email": user_profile.get("email", ""),
                    "avatar": (user_profile.get("first_name", "")[0] if user_profile.get("first_name") else "") + 
                             (user_profile.get("last_name", "")[0] if user_profile.get("last_name") else "")
                }
                members.append(member_data)
        
        return members
    
    @staticmethod
    def create_invitation(group_id: str, inviter_uid: str, invitee_username: str) -> Dict[str, Any]:
        """Create a group invitation"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        # Get invitee by username
        invitee = FirestoreService.get_user_by_username(invitee_username)
        if not invitee:
            raise ValueError(f"User with username '{invitee_username}' not found")
        
        invitee_uid = invitee["firebase_uid"]
        
        # Check if user is already a member
        group = FirestoreService.get_group(group_id)
        if not group:
            raise ValueError(f"Group '{group_id}' not found")
        
        if invitee_uid in group.get("members", []):
            raise ValueError(f"User '{invitee_username}' is already a member of this group")
        
        # Check if invitation already exists
        invitations_ref = db.collection(FirestoreService.INVITATIONS_COLLECTION)
        existing = invitations_ref.where("group_id", "==", group_id)\
                                 .where("invitee_uid", "==", invitee_uid)\
                                 .where("status", "==", "pending").limit(1).get()
        
        if existing:
            raise ValueError(f"Invitation already sent to '{invitee_username}'")
        
        # Create invitation
        invitation_data = {
            "group_id": group_id,
            "inviter_uid": inviter_uid,
            "invitee_uid": invitee_uid,
            "invitee_username": invitee_username,
            "status": "pending",
            "created_at": datetime.utcnow()
        }
        
        doc_ref = db.collection(FirestoreService.INVITATIONS_COLLECTION).document()
        doc_ref.set(invitation_data)
        
        invitation_data["id"] = doc_ref.id
        # Convert datetime
        for key, value in invitation_data.items():
            if hasattr(value, 'isoformat'):
                invitation_data[key] = value.isoformat()
            elif hasattr(value, 'timestamp'):
                invitation_data[key] = value.to_datetime().isoformat()
        
        return invitation_data
    
    @staticmethod
    def add_member_to_group(group_id: str, user_uid: str) -> Dict[str, Any]:
        """Add a user to a group"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        group_ref = db.collection(FirestoreService.GROUPS_COLLECTION).document(group_id)
        group = group_ref.get()
        
        if not group.exists:
            raise ValueError(f"Group '{group_id}' not found")
        
        group_data = group.to_dict()
        members = group_data.get("members", [])
        
        if user_uid in members:
            raise ValueError("User is already a member of this group")
        
        if len(members) >= group_data.get("max_members", 10):
            raise ValueError("Group is full")
        
        # Add member
        members.append(user_uid)
        group_ref.update({
            "members": members,
            "member_count": len(members),
            "last_activity": datetime.utcnow()
        })
        
        return FirestoreService.get_group(group_id)
    
    @staticmethod
    def get_user_groups(user_uid: str, as_creator: bool = False) -> list[Dict[str, Any]]:
        """Get groups where user is a member or creator"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        groups_ref = db.collection(FirestoreService.GROUPS_COLLECTION)
        
        if as_creator:
            query = groups_ref.where("creator_uid", "==", user_uid).limit(50)
        else:
            query = groups_ref.where("members", "array_contains", user_uid).limit(50)
        
        groups = []
        for doc in query.stream():
            group_data = doc.to_dict()
            if group_data:
                group_data["id"] = doc.id
                # Convert datetime objects
                for key, value in group_data.items():
                    if hasattr(value, 'isoformat'):
                        group_data[key] = value.isoformat()
                    elif hasattr(value, 'timestamp'):
                        group_data[key] = value.to_datetime().isoformat()
                groups.append(group_data)
        
        return groups
    
    @staticmethod
    def remove_member_from_group(group_id: str, member_uid: str, remover_uid: str) -> Dict[str, Any]:
        """Remove a member from a group (only creator or the member themselves can do this)"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        group_ref = db.collection(FirestoreService.GROUPS_COLLECTION).document(group_id)
        group = group_ref.get()
        
        if not group.exists:
            raise ValueError(f"Group '{group_id}' not found")
        
        group_data = group.to_dict()
        
        # Check permissions
        if group_data.get("creator_uid") != remover_uid and member_uid != remover_uid:
            raise ValueError("Only the group creator or the member themselves can remove members")
        
        members = group_data.get("members", [])
        
        if member_uid not in members:
            raise ValueError("User is not a member of this group")
        
        if member_uid == group_data.get("creator_uid"):
            raise ValueError("Cannot remove the group creator")
        
        # Remove member
        members.remove(member_uid)
        group_ref.update({
            "members": members,
            "member_count": len(members),
            "last_activity": datetime.utcnow()
        })
        
        return FirestoreService.get_group(group_id)
    
    @staticmethod
    def create_message(
        group_id: str,
        sender_uid: str,
        content: str,
        mentions: Optional[list[str]] = None,
        stock_symbols: Optional[list[str]] = None
    ) -> Dict[str, Any]:
        """Create a message in a group"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        # Verify user is a member
        group = FirestoreService.get_group(group_id)
        if not group:
            raise ValueError(f"Group '{group_id}' not found")
        
        if sender_uid not in group.get("members", []):
            raise ValueError("Only group members can send messages")
        
        message_data = {
            "group_id": group_id,
            "sender_uid": sender_uid,
            "content": content,
            "mentions": mentions or [],
            "stock_symbols": stock_symbols or [],
            "created_at": datetime.utcnow()
        }
        
        # Get sender info
        sender_profile = FirestoreService.get_user_profile(sender_uid)
        if sender_profile:
            message_data["sender_username"] = sender_profile.get("username", "")
            message_data["sender_name"] = f"{sender_profile.get('first_name', '')} {sender_profile.get('last_name', '')}".strip()
            message_data["sender_avatar"] = (sender_profile.get("first_name", "")[0] if sender_profile.get("first_name") else "") + \
                                           (sender_profile.get("last_name", "")[0] if sender_profile.get("last_name") else "")
        
        # Create message
        doc_ref = db.collection(FirestoreService.MESSAGES_COLLECTION).document()
        doc_ref.set(message_data)
        
        # Update group last_activity
        db.collection(FirestoreService.GROUPS_COLLECTION).document(group_id).update({
            "last_activity": datetime.utcnow()
        })
        
        message_data["id"] = doc_ref.id
        # Convert datetime
        for key, value in message_data.items():
            if hasattr(value, 'isoformat'):
                message_data[key] = value.isoformat()
            elif hasattr(value, 'timestamp'):
                message_data[key] = value.to_datetime().isoformat()
        
        return message_data
    
    @staticmethod
    def get_group_messages(group_id: str, limit: int = 50) -> list[Dict[str, Any]]:
        """Get messages for a group"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        messages_ref = db.collection(FirestoreService.MESSAGES_COLLECTION)
        # Get all messages for the group (without order_by to avoid index requirement)
        query = messages_ref.where("group_id", "==", group_id).limit(limit * 2)  # Get more to sort
        
        messages = []
        for doc in query.stream():
            message_data = doc.to_dict()
            if message_data:
                message_data["id"] = doc.id
                # Convert datetime objects
                for key, value in message_data.items():
                    if hasattr(value, 'isoformat'):
                        message_data[key] = value.isoformat()
                    elif hasattr(value, 'timestamp'):
                        message_data[key] = value.to_datetime().isoformat()
                messages.append(message_data)
        
        # Sort by created_at in Python (oldest first)
        messages.sort(key=lambda x: x.get("created_at", ""))
        
        # Return only the requested limit
        return messages[-limit:] if len(messages) > limit else messages
    
    @staticmethod
    def delete_group(group_id: str, user_uid: str) -> bool:
        """Delete a group (only creator can do this)"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        group = FirestoreService.get_group(group_id)
        if not group:
            raise ValueError(f"Group '{group_id}' not found")
        
        if group.get("creator_uid") != user_uid:
            raise ValueError("Only the group creator can delete the group")
        
        # Delete group
        db.collection(FirestoreService.GROUPS_COLLECTION).document(group_id).delete()
        
        # Delete all messages (optional - could also archive)
        messages_ref = db.collection(FirestoreService.MESSAGES_COLLECTION)
        messages = messages_ref.where("group_id", "==", group_id).stream()
        for msg in messages:
            msg.reference.delete()
        
        return True
    
    # Signals methods (from dev branch)
    @staticmethod
    def save_signal_to_history(
        firebase_uid: str,
        signal_id: str,
        signal_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Save a generated signal to user's signal history"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        try:
            # Build signal entry with all available fields
            # Ensure we have reasoning and key_points - these are required for completeness
            reasoning = signal_data.get("reasoning", "")
            key_points = signal_data.get("key_points", [])
            
            # Debug: Log what we're receiving
            print(f"📥 Saving signal for {signal_data.get('ticker', 'UNKNOWN')}:")
            print(f"   - All keys in signal_data: {list(signal_data.keys())}")
            print(f"   - reasoning: {bool(reasoning)} (length: {len(reasoning) if reasoning else 0})")
            print(f"   - key_points: {bool(key_points)} (count: {len(key_points) if key_points else 0})")
            print(f"   - sentiment_analysis: {bool(signal_data.get('sentiment_analysis'))}")
            print(f"   - articles_analyzed: {signal_data.get('articles_analyzed', 0)}")
            
            # Debug: Log if signal is missing critical fields
            if not reasoning or not key_points:
                print(f"⚠️ WARNING: Signal for {signal_data.get('ticker', 'UNKNOWN')} is missing critical fields!")
                print(f"   - Full signal_data: {signal_data}")
            
            signal_entry = {
                "signal_id": signal_id,
                "ticker": signal_data.get("ticker", ""),
                "signal": signal_data.get("signal", "HOLD"),
                "confidence": signal_data.get("confidence", 0.0),
                "risk_level": signal_data.get("risk_level", "UNKNOWN"),
                "reasoning": reasoning,  # Ensure this is not empty
                "key_points": key_points if key_points else [],  # Ensure this is a list
                "sentiment_analysis": signal_data.get("sentiment_analysis", ""),
                "articles_analyzed": signal_data.get("articles_analyzed", 0),
                "generated_at": datetime.utcnow(),
                "created_timestamp": datetime.utcnow(),  # For sorting
                "signal_type": signal_data.get("signal_type", "NEWS")  # Add signal_type field
            }
            
            # Add insider_data if present (even if empty dict - to track that API was called)
            if "insider_data" in signal_data:
                insider_data = signal_data["insider_data"]
                if insider_data and isinstance(insider_data, dict):
                    # Only save if it has actual data (transactions)
                    if insider_data.get("transactions"):
                        signal_entry["insider_data"] = insider_data
                        print(f"   ✅ Saving insider_data with {len(insider_data.get('transactions', []))} transactions")
                    else:
                        print(f"   ⚠️ insider_data exists but has no transactions")
                elif insider_data is None:
                    print(f"   ⚠️ insider_data is None (API may have failed)")
            
            # Add institutional_data if present (even if empty dict - to track that API was called)
            if "institutional_data" in signal_data:
                institutional_data = signal_data["institutional_data"]
                if institutional_data and isinstance(institutional_data, dict):
                    # Only save if it has actual data (holdings)
                    if institutional_data.get("holdings"):
                        signal_entry["institutional_data"] = institutional_data
                        print(f"   ✅ Saving institutional_data with {len(institutional_data.get('holdings', []))} holdings")
                    else:
                        print(f"   ⚠️ institutional_data exists but has no holdings")
                elif institutional_data is None:
                    print(f"   ⚠️ institutional_data is None (API may have failed)")
            
            # Add insider_summary if present
            if "insider_summary" in signal_data and signal_data["insider_summary"]:
                signal_entry["insider_summary"] = signal_data["insider_summary"]
            
            # Add institutional_summary if present
            if "institutional_summary" in signal_data and signal_data["institutional_summary"]:
                signal_entry["institutional_summary"] = signal_data["institutional_summary"]
            
            # Add articles if present
            if "articles" in signal_data and signal_data["articles"]:
                signal_entry["articles"] = signal_data["articles"]
            
            # Save to user's signals subcollection
            user_ref = db.collection(FirestoreService.USERS_COLLECTION).document(firebase_uid)
            user_ref.collection("signals").document(signal_id).set(signal_entry)
            
            # Also save to global signals collection for analytics/trending
            db.collection("signals").document(signal_id).set({
                **signal_entry,
                "firebase_uid": firebase_uid
            })
            
            return signal_entry
        
        except Exception as e:
            raise ValueError(f"Failed to save signal to history: {str(e)}")

    @staticmethod
    def get_signal_history(
        firebase_uid: str,
        limit: int = 20,
        include_all: bool = True,
        from_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get signal generation history, sorted by most recent
        
        Args:
            firebase_uid: User's Firebase UID
            limit: Maximum number of signals to return
            include_all: If True, fetch from global signals collection (all users). 
                        If False, only fetch user's own signals.
            from_date: Only return signals from this date forward (YYYY-MM-DD format)
        """
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        try:
            signals = []
            
            # Parse from_date if provided
            from_datetime = None
            if from_date:
                try:
                    from_datetime = datetime.strptime(from_date, "%Y-%m-%d")
                except ValueError:
                    # Invalid date format, ignore filter
                    pass
            
            if include_all:
                # Fetch from global signals collection (all users' signals)
                signals_ref = db.collection("signals")
                
                # Track counts per category - max 10 per category (NEWS, SEC, INSIDER)
                category_counts = {"NEWS": 0, "SEC": 0, "INSIDER": 0}
                max_per_category = 10
                
                # Track most recent signal per ticker+signal_type to avoid duplicates
                # Key format: "{ticker}_{signal_type}" -> signal_data
                seen_signals = {}
                
                # Fetch many more signals to ensure we get past incomplete ones and find complete signals
                fetch_limit = 500  # Fetch enough to find 10 of each category
                query = signals_ref.order_by("created_timestamp", direction="DESCENDING").limit(fetch_limit)
                docs = query.stream()
                
                for doc in docs:
                    # Stop if we have 10 of each category
                    if all(count >= max_per_category for count in category_counts.values()):
                        break
                    
                    signal_data = doc.to_dict()
                    if signal_data:
                        ticker = signal_data.get('ticker', 'UNKNOWN')
                        # Debug: Log what fields are actually in Firestore
                        if len(signals) < 3 or ticker == 'AMZN':  # Log first 3 OR any AMZN signal
                            print(f"🔍 Firestore signal {doc.id} ({ticker}) fields: {list(signal_data.keys())}")
                            print(f"   - Has reasoning: {bool(signal_data.get('reasoning'))} (value: {str(signal_data.get('reasoning', ''))[:50] if signal_data.get('reasoning') else 'MISSING'}...)")
                            print(f"   - Has key_points: {bool(signal_data.get('key_points'))} (count: {len(signal_data.get('key_points', []))})")
                            print(f"   - Has insider_data: {bool(signal_data.get('insider_data'))}")
                            print(f"   - Has institutional_data: {bool(signal_data.get('institutional_data'))}")
                            
                            # Debug: Log institutional holdings if present
                            if signal_data.get('institutional_data') and signal_data['institutional_data'].get('holdings'):
                                holdings = signal_data['institutional_data']['holdings']
                                print(f"   - Institutional holdings count: {len(holdings)}")
                                if len(holdings) > 0:
                                    first_holding = holdings[0]
                                    print(f"   - First holding fund_name: '{first_holding.get('fund_name')}', fund_cik: '{first_holding.get('fund_cik')}'")
                        
                        # Convert Firestore Timestamps to ISO strings for JSON serialization
                        for key, value in signal_data.items():
                            if hasattr(value, 'to_datetime'):
                                signal_data[key] = value.to_datetime().isoformat()
                            elif hasattr(value, 'isoformat'):
                                signal_data[key] = value.isoformat()
                        
                        # Filter by date if from_date is provided
                        if from_datetime:
                            signal_timestamp = signal_data.get("created_timestamp")
                            if signal_timestamp:
                                # Convert to datetime if it's a string
                                if isinstance(signal_timestamp, str):
                                    try:
                                        signal_dt = datetime.fromisoformat(signal_timestamp.replace('Z', '+00:00'))
                                    except:
                                        continue
                                else:
                                    signal_dt = signal_timestamp
                                
                                # Compare dates (ignore time) - include signals from from_date onwards
                                if isinstance(signal_dt, datetime) and signal_dt.date() < from_datetime.date():
                                    continue  # Skip signals before from_date
                        
                        # Default to "NEWS" for old signals without signal_type (backward compatibility)
                        signal_type = signal_data.get("signal_type")
                        if ticker == 'AMZN':
                            print(f"🔍 [QUERY] AMZN signal {doc.id}: signal_type from Firestore = '{signal_type}'")
                        if not signal_type or signal_type not in ["SEC", "INSIDER", "NEWS"]:
                            # Old signals without signal_type should default to "NEWS"
                            if ticker == 'AMZN':
                                print(f"   ⚠️ [QUERY] AMZN signal missing/invalid signal_type '{signal_type}', defaulting to NEWS")
                            signal_type = "NEWS"
                            signal_data["signal_type"] = "NEWS"  # Set it for the response
                            if len(signals) < 5:  # Log first few for debugging
                                print(f"   ℹ️ Setting signal_type='NEWS' for old signal {signal_data.get('ticker')} (missing signal_type field)")
                        elif ticker == 'AMZN':
                            print(f"   ✅ [QUERY] AMZN signal has valid signal_type: '{signal_type}'")
                        
                        # Check if we already have 10 of this category
                        if category_counts.get(signal_type, 0) >= max_per_category:
                            if ticker == 'AMZN':
                                print(f"   ⏭️ [QUERY] Skipping AMZN {signal_type} signal - already have {category_counts.get(signal_type, 0)} of this type")
                            continue  # Skip if we already have 10 of this category
                        
                        # For each type, verify it has the required data
                        if signal_type == "NEWS":
                            # NEWS signals must have AI-generated content
                            has_reasoning = signal_data.get("reasoning") and len(str(signal_data.get("reasoning", ""))) > 100
                            has_key_points = signal_data.get("key_points") and len(signal_data.get("key_points", [])) > 0
                            has_articles = signal_data.get("articles_analyzed", 0) > 0
                            if not (has_reasoning and has_key_points and has_articles):
                                continue  # Skip incomplete NEWS signals
                        elif signal_type == "SEC":
                            # SEC signals must have institutional data with holdings
                            institutional_data = signal_data.get("institutional_data", {})
                            holdings = institutional_data.get("holdings", []) if institutional_data else []
                            if not holdings or len(holdings) == 0:
                                if ticker == 'AMZN':
                                    print(f"⚠️ [QUERY] Skipping AMZN SEC signal - no holdings found")
                                continue  # Skip SEC signals without holdings
                            elif ticker == 'AMZN':
                                fund_name = holdings[0].get('fund_name') if holdings else 'N/A'
                                signal_timestamp = signal_data.get('created_timestamp', 'N/A')
                                print(f"✅ [QUERY] AMZN SEC signal has {len(holdings)} holdings - checking for duplicates")
                                print(f"   - Fund name: '{fund_name}'")
                                print(f"   - Timestamp: {signal_timestamp}")
                                print(f"   - Signal ID: {doc.id}")
                                # Check if we already have an AMZN_SEC signal
                                signal_key = f"{ticker}_{signal_type}"
                                if signal_key in seen_signals:
                                    existing = seen_signals[signal_key]
                                    existing_holdings = existing.get('institutional_data', {}).get('holdings', [])
                                    existing_fund_name = existing_holdings[0].get('fund_name') if existing_holdings else 'N/A'
                                    existing_timestamp = existing.get('created_timestamp', 'N/A')
                                    print(f"   - ⚠️ Already have AMZN_SEC: fund_name='{existing_fund_name}', timestamp={existing_timestamp}")
                                else:
                                    print(f"   - ✅ No duplicate found, will add this signal")
                        elif signal_type == "INSIDER":
                            # INSIDER signals must have insider data with transactions
                            insider_data = signal_data.get("insider_data", {})
                            transactions = insider_data.get("transactions", []) if insider_data else []
                            if not transactions or len(transactions) == 0:
                                continue  # Skip INSIDER signals without transactions
                        
                        # Signal passed all checks - check if we already have a more recent signal for this ticker+type
                        signal_key = f"{ticker}_{signal_type}"
                        if signal_key in seen_signals:
                            # We already have a signal for this ticker+type
                            # BUT: If the existing signal has 'Unknown Fund' and this one has a real name, prefer this one
                            existing_signal = seen_signals[signal_key]
                            
                            # Check if we should replace the existing signal with this one (if it has better fund names)
                            should_replace = False
                            if signal_type == "SEC":
                                existing_holdings = existing_signal.get('institutional_data', {}).get('holdings', [])
                                current_holdings = signal_data.get('institutional_data', {}).get('holdings', [])
                                
                                if existing_holdings and current_holdings:
                                    existing_fund_name = existing_holdings[0].get('fund_name', '').strip()
                                    current_fund_name = current_holdings[0].get('fund_name', '').strip()
                                    
                                    # Replace if existing has 'Unknown Fund' but current has a real name
                                    if (existing_fund_name in ['Unknown Fund', '', 'Fund CIK-'] or 
                                        existing_fund_name.startswith('Fund CIK-')) and \
                                       current_fund_name not in ['Unknown Fund', '', 'Fund CIK-'] and \
                                       not current_fund_name.startswith('Fund CIK-'):
                                        should_replace = True
                                        if ticker == 'AMZN':
                                            print(f"🔄 [QUERY] Replacing AMZN {signal_type} signal with better fund name")
                                            print(f"   - Old: '{existing_fund_name}' -> New: '{current_fund_name}'")
                            
                            if should_replace:
                                # Remove the old signal and add this one
                                signals.remove(existing_signal)
                                signals.append(signal_data)
                                seen_signals[signal_key] = signal_data
                                if ticker == 'AMZN':
                                    print(f"✅ [QUERY] Replaced AMZN {signal_type} signal in results")
                            else:
                                # We already have a signal for this ticker+type (and it's more recent since we process in DESC order)
                                if ticker == 'AMZN':
                                    existing_holdings = existing_signal.get('institutional_data', {}).get('holdings', [])
                                    existing_fund_name = existing_holdings[0].get('fund_name') if existing_holdings else 'N/A'
                                    current_holdings = signal_data.get('institutional_data', {}).get('holdings', [])
                                    current_fund_name = current_holdings[0].get('fund_name') if current_holdings else 'N/A'
                                    print(f"⏭️ [QUERY] Skipping duplicate AMZN {signal_type} signal")
                                    print(f"   - Existing signal fund_name: '{existing_fund_name}' (timestamp: {existing_signal.get('created_timestamp')})")
                                    print(f"   - Current signal fund_name: '{current_fund_name}' (timestamp: {signal_data.get('created_timestamp')})")
                                continue  # Skip this duplicate
                        
                        # Signal passed all checks - include it
                        signals.append(signal_data)
                        seen_signals[signal_key] = signal_data  # Track that we've seen this ticker+type
                        category_counts[signal_type] = category_counts.get(signal_type, 0) + 1
                        if ticker == 'AMZN':
                            holdings = signal_data.get('institutional_data', {}).get('holdings', [])
                            fund_name = holdings[0].get('fund_name') if holdings else 'N/A'
                            print(f"✅ [QUERY] Added AMZN {signal_type} signal to results")
                            print(f"   - Fund name: '{fund_name}'")
                            print(f"   - Timestamp: {signal_data.get('created_timestamp')}")
                            print(f"   - Total {signal_type} signals: {category_counts.get(signal_type, 0)}")
            else:
                # Only fetch user's own signals
                user_ref = db.collection(FirestoreService.USERS_COLLECTION).document(firebase_uid)
                signals_ref = user_ref.collection("signals")
                
                # Fetch many more signals to ensure we get past incomplete ones and find complete signals
                fetch_limit = limit * 10  # Fetch 10x the limit to find complete signals
                query = signals_ref.order_by("created_timestamp", direction="DESCENDING").limit(fetch_limit)
                docs = query.stream()
                
                for doc in docs:
                    signal_data = doc.to_dict()
                    if signal_data:
                        # Debug: Log what fields are actually in Firestore
                        if len(signals) < 3:  # Only log first 3 for debugging
                            print(f"🔍 Firestore signal {doc.id} fields: {list(signal_data.keys())}")
                            print(f"   - Has reasoning: {bool(signal_data.get('reasoning'))} (value: {str(signal_data.get('reasoning', ''))[:50] if signal_data.get('reasoning') else 'MISSING'}...)")
                            print(f"   - Has key_points: {bool(signal_data.get('key_points'))} (count: {len(signal_data.get('key_points', []))})")
                            print(f"   - Has insider_data: {bool(signal_data.get('insider_data'))}")
                            print(f"   - Has institutional_data: {bool(signal_data.get('institutional_data'))}")
                        
                        # Convert Firestore Timestamps to ISO strings for JSON serialization
                        for key, value in signal_data.items():
                            if hasattr(value, 'to_datetime'):
                                signal_data[key] = value.to_datetime().isoformat()
                            elif hasattr(value, 'isoformat'):
                                signal_data[key] = value.isoformat()
                        
                        # Filter by date if from_date is provided
                        if from_datetime:
                            signal_timestamp = signal_data.get("created_timestamp")
                            if signal_timestamp:
                                # Convert to datetime if it's a string
                                if isinstance(signal_timestamp, str):
                                    try:
                                        signal_dt = datetime.fromisoformat(signal_timestamp.replace('Z', '+00:00'))
                                    except:
                                        continue
                                else:
                                    signal_dt = signal_timestamp
                                
                                # Compare dates (ignore time) - include signals from from_date onwards
                                if isinstance(signal_dt, datetime) and signal_dt.date() < from_datetime.date():
                                    continue  # Skip signals before from_date
                        
                        # Default to "NEWS" for old signals without signal_type (backward compatibility)
                        signal_type = signal_data.get("signal_type")
                        if not signal_type or signal_type not in ["SEC", "INSIDER", "NEWS"]:
                            # Old signals without signal_type should default to "NEWS"
                            signal_type = "NEWS"
                            signal_data["signal_type"] = "NEWS"  # Set it for the response
                            if len(signals) < 5:  # Log first few for debugging
                                print(f"   ℹ️ Setting signal_type='NEWS' for old signal {signal_data.get('ticker')} (missing signal_type field)")
                        
                        # For each type, verify it has the required data
                        if signal_type == "NEWS":
                            # NEWS signals must have AI-generated content
                            has_reasoning = signal_data.get("reasoning") and len(str(signal_data.get("reasoning", ""))) > 100
                            has_key_points = signal_data.get("key_points") and len(signal_data.get("key_points", [])) > 0
                            has_articles = signal_data.get("articles_analyzed", 0) > 0
                            if not (has_reasoning and has_key_points and has_articles):
                                continue  # Skip incomplete NEWS signals
                        elif signal_type == "SEC":
                            # SEC signals must have institutional data with holdings
                            institutional_data = signal_data.get("institutional_data", {})
                            holdings = institutional_data.get("holdings", []) if institutional_data else []
                            if not holdings or len(holdings) == 0:
                                continue  # Skip SEC signals without holdings
                        elif signal_type == "INSIDER":
                            # INSIDER signals must have insider data with transactions
                            insider_data = signal_data.get("insider_data", {})
                            transactions = insider_data.get("transactions", []) if insider_data else []
                            if not transactions or len(transactions) == 0:
                                continue  # Skip INSIDER signals without transactions
                        
                        # Signal passed all checks - include it
                        signals.append(signal_data)
                        if len(signals) >= limit:
                            break
            
            # Count signals by category for logging
            category_breakdown = {"NEWS": 0, "SEC": 0, "INSIDER": 0}
            for sig in signals:
                sig_type = sig.get("signal_type", "NEWS")
                if sig_type in category_breakdown:
                    category_breakdown[sig_type] += 1
            
            print(f"✅ Firestore query complete: Found {len(signals)} signals (NEWS: {category_breakdown['NEWS']}, SEC: {category_breakdown['SEC']}, INSIDER: {category_breakdown['INSIDER']})")
            return signals
        
        except Exception as e:
            raise ValueError(f"Failed to get signal history: {str(e)}")

    @staticmethod
    def get_signal_history_for_ticker(
        firebase_uid: str,
        ticker: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get signal history for a specific ticker"""
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        try:
            user_ref = db.collection(FirestoreService.USERS_COLLECTION).document(firebase_uid)
            signals_ref = user_ref.collection("signals")
            
            # Query signals for specific ticker
            query = (
                signals_ref
                .where("ticker", "==", ticker)
                .order_by("created_timestamp", direction="DESCENDING")
                .limit(limit)
            )
            docs = query.stream()
            
            signals = []
            for doc in docs:
                signal_data = doc.to_dict()
                signals.append(signal_data)
            
            return signals
        
        except Exception as e:
            raise ValueError(f"Failed to get ticker history: {str(e)}")

    @staticmethod
    def get_latest_signal_for_ticker(
        ticker: str,
        from_date: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get the most recent signal for a ticker from global signals collection (all users)
        
        Args:
            ticker: Stock ticker symbol
            from_date: Only check signals from this date forward (YYYY-MM-DD format)
        """
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        try:
            # Check global signals collection (all users)
            signals_ref = db.collection("signals")
            
            query = (
                signals_ref
                .where("ticker", "==", ticker.upper())
                .order_by("created_timestamp", direction="DESCENDING")
                .limit(1)
            )
            docs = query.stream()
            
            for doc in docs:
                signal_data = doc.to_dict()
                if signal_data:
                    # Filter by date if provided
                    if from_date:
                        try:
                            from_datetime = datetime.strptime(from_date, "%Y-%m-%d")
                            signal_timestamp = signal_data.get("created_timestamp")
                            if signal_timestamp:
                                if hasattr(signal_timestamp, 'to_datetime'):
                                    signal_dt = signal_timestamp.to_datetime()
                                elif hasattr(signal_timestamp, 'isoformat'):
                                    signal_dt = signal_timestamp
                                else:
                                    try:
                                        signal_dt = datetime.fromisoformat(str(signal_timestamp).replace('Z', '+00:00'))
                                    except:
                                        return None
                                
                                if signal_dt.date() < from_datetime.date():
                                    return None  # Signal is too old
                        except ValueError:
                            pass  # Invalid date format, ignore filter
                    
                    return signal_data
            
            return None
        
        except Exception as e:
            raise ValueError(f"Failed to get latest signal: {str(e)}")
    
    # IPO storage methods
    @staticmethod
    def store_ipo(ipo_id: str, ipo_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Store or update an IPO with its AI evaluation in Firestore
        IPOs are shared across all users, so they only need to be evaluated once
        
        Args:
            ipo_id: Unique IPO identifier (format: ticker-date)
            ipo_data: Complete IPO data including AI risk evaluation
        """
        db = get_firestore_client()
        if not db:
            raise ValueError("Firestore not initialized. Please configure Firebase credentials.")
        
        try:
            # Prepare IPO document with timestamp
            ipo_doc = {
                **ipo_data,
                "updated_at": datetime.utcnow(),
                "created_at": datetime.utcnow() if "created_at" not in ipo_data else ipo_data.get("created_at")
            }
            
            # Convert any datetime objects to Firestore-compatible format
            for key, value in ipo_doc.items():
                if isinstance(value, datetime):
                    ipo_doc[key] = value
                elif isinstance(value, str) and key.endswith("_at") or key == "expectedDate":
                    # Keep as string for expectedDate
                    pass
            
            # Store/update IPO (use merge to avoid overwriting if it exists)
            doc_ref = db.collection(FirestoreService.IPOS_COLLECTION).document(ipo_id)
            doc_ref.set(ipo_doc, merge=True)
            
            print(f"✅ Stored IPO {ipo_id} in Firestore with AI evaluation")
            return ipo_doc
        
        except Exception as e:
            print(f"⚠️ Failed to store IPO {ipo_id} in Firestore: {str(e)}")
            raise ValueError(f"Failed to store IPO: {str(e)}")
    
    @staticmethod
    def get_ipo(ipo_id: str) -> Optional[Dict[str, Any]]:
        """
        Get an IPO from Firestore by ID
        
        Args:
            ipo_id: Unique IPO identifier (format: ticker-date)
        """
        db = get_firestore_client()
        if not db:
            return None  # Firestore not available, return None
        
        try:
            doc_ref = db.collection(FirestoreService.IPOS_COLLECTION).document(ipo_id)
            doc = doc_ref.get()
            
            if doc.exists:
                ipo_data = doc.to_dict()
                if ipo_data:
                    # Convert Firestore Timestamps to ISO strings
                    for key, value in ipo_data.items():
                        if hasattr(value, 'to_datetime'):
                            ipo_data[key] = value.to_datetime().isoformat()
                        elif hasattr(value, 'isoformat') and not isinstance(value, str):
                            ipo_data[key] = value.isoformat()
                    
                    return ipo_data
            return None
        
        except Exception as e:
            print(f"⚠️ Failed to get IPO {ipo_id} from Firestore: {str(e)}")
            return None
    
    @staticmethod
    def get_ipos_by_date_range(from_date: str, to_date: str) -> List[Dict[str, Any]]:
        """
        Get all IPOs within a date range from Firestore
        
        Args:
            from_date: Start date (YYYY-MM-DD)
            to_date: End date (YYYY-MM-DD)
        """
        db = get_firestore_client()
        if not db:
            return []
        
        try:
            ipos_ref = db.collection(FirestoreService.IPOS_COLLECTION)
            # Query IPOs where expectedDate is between from_date and to_date
            query = ipos_ref.where("expectedDate", ">=", from_date)\
                           .where("expectedDate", "<=", to_date)\
                           .order_by("expectedDate")
            
            ipos = []
            for doc in query.stream():
                ipo_data = doc.to_dict()
                if ipo_data:
                    # Convert Firestore Timestamps to ISO strings
                    for key, value in ipo_data.items():
                        if hasattr(value, 'to_datetime'):
                            ipo_data[key] = value.to_datetime().isoformat()
                        elif hasattr(value, 'isoformat') and not isinstance(value, str):
                            ipo_data[key] = value.isoformat()
                    
                    ipos.append(ipo_data)
            
            return ipos
        
        except Exception as e:
            print(f"⚠️ Failed to get IPOs from Firestore: {str(e)}")
            return []
    
    @staticmethod
    def get_all_cached_ipos(limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get all cached IPOs from Firestore (for debugging/management)
        """
        db = get_firestore_client()
        if not db:
            return []
        
        try:
            ipos_ref = db.collection(FirestoreService.IPOS_COLLECTION)
            query = ipos_ref.order_by("updated_at", direction="DESCENDING").limit(limit)
            
            ipos = []
            for doc in query.stream():
                ipo_data = doc.to_dict()
                if ipo_data:
                    # Convert Firestore Timestamps to ISO strings
                    for key, value in ipo_data.items():
                        if hasattr(value, 'to_datetime'):
                            ipo_data[key] = value.to_datetime().isoformat()
                        elif hasattr(value, 'isoformat') and not isinstance(value, str):
                            ipo_data[key] = value.isoformat()
                    
                    ipos.append(ipo_data)
            
            return ipos
        
        except Exception as e:
            print(f"⚠️ Failed to get cached IPOs from Firestore: {str(e)}")
            return []
