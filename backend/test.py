from tests import variables, access_test

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(
                    prog='Test',
                    description='Start testing',
                    epilog='Good testings')
    p.add_argument("-c", "--compact", nargs='?', const=True, default=False)
    p.add_argument("-d", "--debug", nargs='?', const=True, default=False)
    args = p.parse_args()
    variables.compact = args.compact
    variables.debug = args.debug
    access_test.start()
    pass