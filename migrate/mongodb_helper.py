import pymongo
from bson.objectid import ObjectId

from secret_config import MONGO_DB_NAME

def insert_character_to_mongo(mongodb_uri, user, group, notes):
    client = pymongo.MongoClient(mongodb_uri)
    db = client[MONGO_DB_NAME]
    collection = db["characters"]
    character_notes = []
    for note in notes:
        if note['owner_id'] == user['vk_user_id'] and note['group_id'] == group['vk_group_id']:
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

def insert_template_to_mongo(mongodb_uri, group):
    client = pymongo.MongoClient(mongodb_uri)
    db = client[MONGO_DB_NAME]
    collection = db["templates"]  
    document = {
        "uuid": str(ObjectId()),
        "name": f"Template {group['group_name']}",
        "description": "some description",
    }
    result = collection.insert_one(document)
    return result.inserted_id

def insert_item_to_mongo(mongodb_uri, item):
    client = pymongo.MongoClient(mongodb_uri)
    db = client[MONGO_DB_NAME]
    collection = db["items"]  
    document = {
        "uuid": str(ObjectId()),
        "name": f"{item['name']}",
        "description": f"{item['description']}",
    }
    result = collection.insert_one(document)
    return result.inserted_id