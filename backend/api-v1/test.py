from tests import test_variables
from tests import main_test

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(
                    prog='Test',
                    description='Start testing',
                    epilog='Good testings')
    p.add_argument("-c", "--compact", nargs='?', const=True, default=False)
    p.add_argument("-d", "--debug", nargs='?', const=True, default=False)
    args = p.parse_args()
    test_variables.compact = args.compact
    test_variables.debug = args.debug
    main_test.start()
    pass