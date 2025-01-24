import pymongo
from bson.objectid import ObjectId

from secret_config import MONGO_DB_NAME

def insert_character_to_mongo(mongodb_uri, user, group, notes, user_items):
    client = pymongo.MongoClient(mongodb_uri)
    db = client[MONGO_DB_NAME]
    collection = db["characters"]
    character_notes = []
    character_items = []
    group_id = group['vk_group_id']
    user_id = user['vk_user_id']
    for note in notes:
        if note['owner_id'] == user_id and note['group_id'] == group_id:
            character_notes.append({
                "header": note['header'],
                "body": note['description'],
                "addition_date": note['addition_date'],
                "modified_date": note['modified_date']
            }) 
    for item in user_items:
        if item['owner_id'] == user_id and item['group_id'] == group_id:
            character_items.append({
                "name": item['name'],
                "description": item['description'],
                "image_link": item['image_link'],
                "amount": item['amount'],
            }) 
    document = {
        "uuid": str(ObjectId()),
        "name": f"{user['first_name']} {user['last_name']}",
        "description": "some description",
        "notes": character_notes,
        "items": character_items
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
        "description": f"{item['description']}"
    }
    result = collection.insert_one(document)
    return result.inserted_id