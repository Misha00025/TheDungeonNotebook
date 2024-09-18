from tests import variables, item_test, request_tests, access_test, items_request_test, users_test, groups_test

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(
                    prog='Test',
                    description='Start testing',
                    epilog='Good testings')
    p.add_argument("-c", "--compact", nargs='?', const=True, default=False)
    args = p.parse_args()
    variables.compact = args.compact
    # request_tests.start()
    # request_groups.start()
    # item_test.start()
    # access_test.start()
    # items_request_test.start()
    users_test.start()
    groups_test.start()
    pass