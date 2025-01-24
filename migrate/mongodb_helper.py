import pymongo
from bson.objectid import ObjectId
from config import MONGODB_URI

def insert_character_to_mongo(mongodb_uri, user, group, notes):
    client = pymongo.MongoClient(mongodb_uri)
    db = client["database"]
    collection = db["characters"]
    
    character_notes = []
    for note in notes:
        if note['owner_id'] == user['user_id'] and note['group_id'] == group['group_id']:
            character_notes.append({
                "header": note['header'],
                "body": note['description']
            })
            
    document = {
        "uuid": str(ObjectId()),
        "name": f"{user['first_name']} {user['last_name']}",
        "description": "some description",
        "notes": character_notes
    }
    
    result = collection.insert_one(document)
    
    return result.inserted_id