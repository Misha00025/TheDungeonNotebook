

def start():
    from app.access_management import access_to_group
    print(access_to_group("test_user", "-101"))
    print(access_to_group("test_user", "-100"))
    print(access_to_group("tester", "-101"))
    print(access_to_group("tester", "-100"))