"""
Script to clean up incomplete signals from Firestore.
Removes signals that are missing critical fields (reasoning, key_points, insider_data, institutional_data).
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.firestore import FirestoreService
from app.config import Settings

def cleanup_incomplete_signals():
    """Remove incomplete signals from Firestore"""
    print("🧹 Starting cleanup of incomplete signals...")
    
    try:
        # Get Firestore client
        from app.services.firestore import get_firestore_client
        db = get_firestore_client()
        if not db:
            print("❌ Firestore not initialized. Make sure Firebase credentials are set.")
            return
        
        signals_ref = db.collection("signals")
        all_docs = signals_ref.stream()
        
        deleted_count = 0
        kept_count = 0
        
        for doc in all_docs:
            signal_data = doc.to_dict()
            if not signal_data:
                continue
            
            # Check if signal is incomplete
            has_reasoning = signal_data.get("reasoning") and len(signal_data.get("reasoning", "")) > 50
            has_key_points = signal_data.get("key_points") and len(signal_data.get("key_points", [])) > 0
            has_insider_data = signal_data.get("insider_data") and signal_data.get("insider_data", {}).get("transactions")
            has_institutional_data = signal_data.get("institutional_data") and signal_data.get("institutional_data", {}).get("holdings")
            
            signal_type = signal_data.get("signal_type", "NEWS")
            
            # Determine if signal is complete based on type
            is_complete = False
            if signal_type == "INSIDER":
                is_complete = bool(has_insider_data)
            elif signal_type == "SEC":
                is_complete = bool(has_institutional_data)
            else:  # NEWS
                is_complete = has_reasoning and has_key_points
            
            if not is_complete:
                ticker = signal_data.get("ticker", "UNKNOWN")
                print(f"   🗑️  Deleting incomplete signal: {ticker} (type: {signal_type})")
                doc.reference.delete()
                deleted_count += 1
            else:
                kept_count += 1
        
        print(f"\n✅ Cleanup complete!")
        print(f"   - Deleted: {deleted_count} incomplete signals")
        print(f"   - Kept: {kept_count} complete signals")
        
    except Exception as e:
        print(f"❌ Error during cleanup: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    cleanup_incomplete_signals()

